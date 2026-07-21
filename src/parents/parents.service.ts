import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttendancesService } from '../attendances/attendances.service';
import type {
  JustificationResponse,
  PendingJustificationResponse,
} from '../attendances/attendances.service';
import { CreateParentJustificationDto } from './dto/create-parent-justification.dto';
import { SendParentTeacherMessageDto } from './dto/send-parent-teacher-message.dto';
import { EventsService, EventResponse } from '../events/events.service';
import { Grade } from '../grades/entities/grade.entity';
import {
  AccountStatementDto,
  TreasuryService,
} from '../treasury/treasury.service';
import { PayVisaDto } from '../treasury/dto/pay-visa.dto';
import { BoletaVentaDto, PayVisaResultDto } from '../treasury/dto/boleta-venta.dto';
import {
  HorariosService,
  HorarioContextResponse,
} from '../horarios/horarios.service';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { StudentsService } from '../students/students.service';
import { TasksService } from '../tasks/tasks.service';
import { ParentStudent } from './entities/parent-student.entity';
import { ParentTeacherMessage } from './entities/parent-teacher-message.entity';
import { eventAppliesToChild } from './parent-events.util';

export interface HijoResumen {
  studentId: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  nivel: string;
  grado: string;
  seccion: string;
  aulaLabel: string;
  parentesco: string;
}

export interface CursoSeguimiento {
  curso: string;
  promedio: number | null;
  nivel: string | null;
  b1: number | null;
  b2: number | null;
  b3: number | null;
  b4: number | null;
  ultimasNotas: {
    id: number;
    descripcion: string;
    nota: number;
    fecha: string;
    bimestre: number;
    tipo: string;
  }[];
}

export interface AsistenciaSeguimiento {
  asistenciaPct: number;
  totalDias: number;
  presentes: number;
  faltas: number;
  tardanzas: number;
  justificadas: number;
  inasistenciasNetas: number;
  reciente: {
    id: number;
    fecha: string;
    estado: string;
    observacion?: string;
  }[];
}

export interface TareaSeguimiento {
  id: number;
  titulo: string;
  curso: string;
  fechaEntrega: string;
  estado: string;
  prioridad: string;
  comentarioEntrega: string;
  archivoEntregaUrl: string | null;
  archivoEntregaNombre: string | null;
  archivoEntregaMime: string | null;
  fechaEntregaReal: string | null;
  nota: number | null;
  retroalimentacion: string;
  calificadoAt: string | null;
}

export interface SeguimientoAcademico {
  estudiante: HijoResumen;
  promedioGeneral: number | null;
  nivelGeneral: string | null;
  asistencia: AsistenciaSeguimiento;
  tareasPendientes: number;
  tareasVencidas: number;
  tareasEntregadas: number;
  tareasCalificadas: number;
  cursos: CursoSeguimiento[];
  tareas: TareaSeguimiento[];
}

export interface ParentCalendarioHijo {
  studentId: number;
  nombreCompleto: string;
  aulaLabel: string;
  eventos: EventResponse[];
}

export interface ParentEstadoCuenta extends AccountStatementDto {
  estudiante: HijoResumen;
}

export interface ParentHorarioHijo {
  estudiante: HijoResumen;
  anioEscolar: number;
  periodos: HorarioContextResponse['periodos'];
  cursos: HorarioContextResponse['cursos'];
  docentes: HorarioContextResponse['docentes'];
  blocks: HorarioContextResponse['blocks'];
}

export interface ParentTeacherContact {
  docenteId: number;
  nombreCompleto: string;
  email: string;
  especialidad: string;
  cursos: string[];
  hijos: { studentId: number; nombreCompleto: string; aulaLabel: string }[];
}

export interface ParentTeacherMessageResponse {
  id: number;
  studentId: number;
  studentNombre: string;
  docenteId: number;
  docenteNombre: string;
  docenteEmail: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  createdAt: string;
}

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(ParentStudent)
    private readonly parentStudentsRepo: Repository<ParentStudent>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    @InjectRepository(Docente)
    private readonly docenteRepo: Repository<Docente>,
    @InjectRepository(ParentTeacherMessage)
    private readonly messagesRepo: Repository<ParentTeacherMessage>,
    private readonly studentsService: StudentsService,
    private readonly attendancesService: AttendancesService,
    private readonly tasksService: TasksService,
    private readonly eventsService: EventsService,
    private readonly horariosService: HorariosService,
    private readonly treasuryService: TreasuryService,
  ) {}

  async getChildProfile(studentId: number, parentEmail: string) {
    const parentesco = await this.assertParentAccess(studentId, parentEmail);
    const expediente = await this.studentsService.findExpediente(studentId);
    return {
      ...expediente,
      parentesco,
      estudiante: this.toHijoResumen(
        await this.studentsService.findOne(studentId),
        parentesco,
      ),
    };
  }

  async getAccountStatementForChild(
    studentId: number,
    parentEmail: string,
    anioEscolar?: number,
  ): Promise<ParentEstadoCuenta> {
    const parentesco = await this.assertParentAccess(studentId, parentEmail);
    const student = await this.studentsService.findOne(studentId);
    const anio = anioEscolar ?? new Date().getFullYear();
    const statement = await this.treasuryService.getAccountStatement(
      studentId,
      anio,
    );

    return {
      ...statement,
      estudiante: this.toHijoResumen(student, parentesco),
    };
  }

  async payChargeWithVisa(
    studentId: number,
    chargeId: number,
    parentEmail: string,
    parentNombre: string,
    dto: PayVisaDto,
  ): Promise<PayVisaResultDto> {
    await this.assertParentAccess(studentId, parentEmail);
    return this.treasuryService.payChargeWithVisa(
      studentId,
      chargeId,
      dto,
      parentNombre || parentEmail || 'Portal padre',
    );
  }

  async getPaymentReceiptForChild(
    studentId: number,
    paymentId: number,
    parentEmail: string,
    parentNombre: string,
  ): Promise<BoletaVentaDto> {
    await this.assertParentAccess(studentId, parentEmail);
    return this.treasuryService.getPaymentReceipt(
      studentId,
      paymentId,
      parentNombre || parentEmail,
    );
  }

  async getHorarioForChild(
    studentId: number,
    parentEmail: string,
    anioEscolar?: number,
  ): Promise<ParentHorarioHijo> {
    const parentesco = await this.assertParentAccess(studentId, parentEmail);
    const student = await this.studentsService.findOne(studentId);
    const anio = anioEscolar ?? new Date().getFullYear();
    const ctx = await this.horariosService.getContext(anio);

    const nivel = student.nivel;
    const grado = normalizeGradoMatricula(student.grado);
    const seccion = student.seccion.trim().toUpperCase();

    const blocks = ctx.blocks.filter(
      (b) =>
        b.nivel === nivel &&
        normalizeGradoMatricula(b.grado) === grado &&
        b.seccion.trim().toUpperCase() === seccion,
    );
    const cursoIds = new Set(blocks.map((b) => b.cursoId));
    const docenteIds = new Set(blocks.map((b) => b.docenteId));

    return {
      estudiante: this.toHijoResumen(student, parentesco),
      anioEscolar: ctx.anioEscolar,
      periodos: ctx.periodos.filter((p) => p.niveles.includes(nivel)),
      cursos: ctx.cursos.filter((c) => cursoIds.has(c.id)),
      docentes: ctx.docentes.filter((d) => docenteIds.has(d.id)),
      blocks,
    };
  }

  async getTeachersForParent(
    parentEmail: string,
  ): Promise<ParentTeacherContact[]> {
    const hijos = await this.getChildren(parentEmail);
    if (!hijos.length) return [];

    type Acc = {
      docenteId: number;
      cursos: Set<string>;
      hijos: Map<number, { studentId: number; nombreCompleto: string; aulaLabel: string }>;
    };
    const byDocente = new Map<number, Acc>();

    for (const hijo of hijos) {
      const horario = await this.getHorarioForChild(hijo.studentId, parentEmail);
      const cursoById = new Map(horario.cursos.map((c) => [c.id, c.nombre]));
      for (const block of horario.blocks) {
        if (!block.docenteId) continue;
        let acc = byDocente.get(block.docenteId);
        if (!acc) {
          acc = {
            docenteId: block.docenteId,
            cursos: new Set(),
            hijos: new Map(),
          };
          byDocente.set(block.docenteId, acc);
        }
        const cursoNombre = cursoById.get(block.cursoId);
        if (cursoNombre) acc.cursos.add(cursoNombre);
        acc.hijos.set(hijo.studentId, {
          studentId: hijo.studentId,
          nombreCompleto: hijo.nombreCompleto,
          aulaLabel: hijo.aulaLabel,
        });
      }
    }

    if (!byDocente.size) return [];

    const docentes = await this.docenteRepo.find({
      where: { id: In([...byDocente.keys()]) },
    });
    const docenteMap = new Map(docentes.map((d) => [d.id, d]));

    return [...byDocente.values()]
      .map((acc) => {
        const d = docenteMap.get(acc.docenteId);
        if (!d || d.estado !== 'activo') return null;
        return {
          docenteId: d.id,
          nombreCompleto: `${d.nombres} ${d.apellidos}`.trim(),
          email: d.email,
          especialidad: d.especialidad || '',
          cursos: [...acc.cursos].sort((a, b) => a.localeCompare(b, 'es')),
          hijos: [...acc.hijos.values()].sort((a, b) =>
            a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'),
          ),
        } satisfies ParentTeacherContact;
      })
      .filter((x): x is ParentTeacherContact => x !== null)
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }

  async getTeacherMessages(
    parentEmail: string,
  ): Promise<ParentTeacherMessageResponse[]> {
    const email = parentEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('El email del apoderado es obligatorio');
    }

    const rows = await this.messagesRepo.find({
      where: { parentEmail: email },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentNombre: r.studentNombre,
      docenteId: r.docenteId,
      docenteNombre: r.docenteNombre,
      docenteEmail: r.docenteEmail,
      asunto: r.asunto,
      cuerpo: r.cuerpo,
      estado: r.estado,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async sendTeacherMessage(
    parentEmail: string,
    parentNombre: string,
    dto: SendParentTeacherMessageDto,
  ): Promise<ParentTeacherMessageResponse> {
    const email = parentEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('El email del apoderado es obligatorio');
    }

    await this.assertParentAccess(dto.studentId, email);
    const teachers = await this.getTeachersForParent(email);
    const teacher = teachers.find((t) => t.docenteId === dto.docenteId);
    if (!teacher) {
      throw new NotFoundException(
        'El docente no está vinculado a tus hijos o no tiene horario asignado',
      );
    }
    if (!teacher.hijos.some((h) => h.studentId === dto.studentId)) {
      throw new BadRequestException(
        'El docente seleccionado no imparte clases a ese estudiante',
      );
    }

    const hijo = teacher.hijos.find((h) => h.studentId === dto.studentId)!;
    const asunto = dto.asunto.trim();
    const cuerpo = dto.cuerpo.trim();
    if (!asunto || !cuerpo) {
      throw new BadRequestException('Asunto y mensaje son obligatorios');
    }

    // Envío simulado: se registra en BD. Integrar SMTP (nodemailer) cuando haya config.
    // eslint-disable-next-line no-console
    console.log(
      `[correo-docente] De: ${email} → ${teacher.email} | ${asunto} | alumno: ${hijo.nombreCompleto}`,
    );

    const saved = await this.messagesRepo.save(
      this.messagesRepo.create({
        parentEmail: email,
        parentNombre: parentNombre?.trim() || email,
        studentId: hijo.studentId,
        studentNombre: hijo.nombreCompleto,
        docenteId: teacher.docenteId,
        docenteNombre: teacher.nombreCompleto,
        docenteEmail: teacher.email,
        asunto,
        cuerpo,
        estado: 'enviado',
      }),
    );

    return {
      id: saved.id,
      studentId: saved.studentId,
      studentNombre: saved.studentNombre,
      docenteId: saved.docenteId,
      docenteNombre: saved.docenteNombre,
      docenteEmail: saved.docenteEmail,
      asunto: saved.asunto,
      cuerpo: saved.cuerpo,
      estado: saved.estado,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async getEventsForParent(
    parentEmail: string,
    mes?: string,
  ): Promise<ParentCalendarioHijo[]> {
    const hijos = await this.getChildren(parentEmail);
    if (!hijos.length) return [];

    const allEvents = await this.eventsService.findAll(
      mes?.trim() ? { mes: mes.trim() } : undefined,
    );

    return hijos.map((hijo) => ({
      studentId: hijo.studentId,
      nombreCompleto: hijo.nombreCompleto,
      aulaLabel: hijo.aulaLabel,
      eventos: allEvents
        .filter((event) => eventAppliesToChild(event, hijo))
        .sort((a, b) => {
          const byDate = a.fechaInicio.localeCompare(b.fechaInicio);
          return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
        }),
    }));
  }

  async getChildren(parentEmail: string): Promise<HijoResumen[]> {
    const email = parentEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('El email del apoderado es obligatorio');
    }

    const byStudentId = new Map<number, HijoResumen>();

    const links = await this.parentStudentsRepo.find({
      where: { parentEmail: email },
    });
    for (const link of links) {
      const student = await this.studentsService.findOne(link.studentId);
      if (!student.activo) continue;
      byStudentId.set(student.id, this.toHijoResumen(student, link.parentesco));
    }

    const students = await this.studentsService.findAll();
    for (const student of students) {
      if (!student.activo || byStudentId.has(student.id)) continue;

      const reps: { email?: string; parentesco: string }[] = [
        { email: student.apoderado?.email, parentesco: 'apoderado' },
        { email: student.padre?.email, parentesco: 'padre' },
        { email: student.madre?.email, parentesco: 'madre' },
      ];

      for (const rep of reps) {
        if (rep.email?.trim().toLowerCase() === email) {
          byStudentId.set(student.id, this.toHijoResumen(student, rep.parentesco));
          break;
        }
      }
    }

    return [...byStudentId.values()].sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'),
    );
  }

  async getAcademicTracking(
    studentId: number,
    parentEmail?: string,
  ): Promise<SeguimientoAcademico> {
    const student = await this.studentsService.findOne(studentId);
    const parentesco = parentEmail
      ? await this.assertParentAccess(studentId, parentEmail)
      : 'apoderado';

    const grades = await this.gradesRepo.find({
      where: { studentId },
      order: { fechaEvaluacion: 'DESC' },
    });

    const attendances = await this.attendancesService.findAll({ studentId });
    const tasks = await this.tasksService.findAll({ studentId });

    const cursos = this.buildCursosSeguimiento(grades);
    const promediosCursos = cursos
      .map(c => c.promedio)
      .filter((v): v is number => v !== null);
    const promedioGeneral = promediosCursos.length
      ? round2(promediosCursos.reduce((s, v) => s + v, 0) / promediosCursos.length)
      : null;

    const presentes = attendances.filter(a => a.estado === 'P').length;
    const faltas = attendances.filter(a => a.estado === 'F').length;
    const tardanzas = attendances.filter(a => a.estado === 'T').length;
    const justificadas = attendances.filter(a => a.estado === 'J').length;
    const totalDias = attendances.length;
    const inasistenciasNetas = Math.max(faltas - justificadas, 0);

    return {
      estudiante: this.toHijoResumen(student, parentesco),
      promedioGeneral,
      nivelGeneral: promedioGeneral !== null ? nivelFromNota(promedioGeneral) : null,
      asistencia: {
        asistenciaPct: totalDias ? Math.round((presentes / totalDias) * 100) : 0,
        totalDias,
        presentes,
        faltas,
        tardanzas,
        justificadas,
        inasistenciasNetas,
        reciente: attendances
          .slice()
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
          .slice(0, 8)
          .map(a => ({
            id: a.id,
            fecha: a.fecha,
            estado: a.estado,
            observacion: a.observacion,
          })),
      },
      tareasPendientes: tasks.filter(t => t.estado === 'PENDING').length,
      tareasVencidas: tasks.filter(t => t.estado === 'OVERDUE').length,
      tareasEntregadas: tasks.filter(t => t.estado === 'SUBMITTED').length,
      tareasCalificadas: tasks.filter(t => t.estado === 'GRADED').length,
      cursos,
      tareas: tasks.map(t => ({
        id: t.id,
        titulo: t.titulo,
        curso: t.curso,
        fechaEntrega: t.fechaEntrega,
        estado: t.estado,
        prioridad: t.prioridad,
        comentarioEntrega: t.comentarioEntrega ?? '',
        archivoEntregaUrl: t.archivoEntregaUrl ?? null,
        archivoEntregaNombre: t.archivoEntregaNombre ?? null,
        archivoEntregaMime: t.archivoEntregaMime ?? null,
        fechaEntregaReal: t.fechaEntregaReal ?? null,
        nota: t.nota ?? null,
        retroalimentacion: t.retroalimentacion ?? '',
        calificadoAt: t.calificadoAt ?? null,
      })),
    };
  }

  async getPendingJustifications(
    studentId: number,
    parentEmail: string,
    mes?: string,
  ): Promise<PendingJustificationResponse[]> {
    await this.assertParentLink(studentId, parentEmail);
    return this.attendancesService.findPending({ studentId, mes });
  }

  async getJustifications(
    studentId: number,
    parentEmail: string,
    mes?: string,
  ): Promise<JustificationResponse[]> {
    await this.assertParentLink(studentId, parentEmail);
    return this.attendancesService.findJustifications({ studentId, mes });
  }

  async createJustification(
    studentId: number,
    parentEmail: string,
    dto: CreateParentJustificationDto,
  ): Promise<JustificationResponse> {
    const link = await this.assertParentLink(studentId, parentEmail);
    const student = await this.studentsService.findOne(studentId);
    const registradoPor = `${link.parentesco} — ${student.nombre} ${student.apellido} (${parentEmail.toLowerCase()})`;

    return this.attendancesService.createJustification({
      studentId,
      cantidad: dto.cantidad,
      motivo: dto.motivo,
      observacion: dto.observacion,
      registradoPor,
    });
  }

  private async assertParentLink(
    studentId: number,
    parentEmail: string,
  ): Promise<{ parentesco: string }> {
    const parentesco = await this.assertParentAccess(studentId, parentEmail);
    return { parentesco };
  }

  /** Valida acceso del apoderado (tabla parent_students o email en ficha del alumno). */
  private async assertParentAccess(
    studentId: number,
    parentEmail: string,
  ): Promise<string> {
    if (!parentEmail?.trim()) {
      throw new BadRequestException('El email del apoderado es obligatorio');
    }

    const email = parentEmail.trim().toLowerCase();
    const link = await this.parentStudentsRepo.findOne({
      where: { parentEmail: email, studentId },
    });
    if (link) return link.parentesco;

    const student = await this.studentsService.findOne(studentId);
    const reps: { email?: string; parentesco: string }[] = [
      { email: student.apoderado?.email, parentesco: 'apoderado' },
      { email: student.padre?.email, parentesco: 'padre' },
      { email: student.madre?.email, parentesco: 'madre' },
    ];
    for (const rep of reps) {
      if (rep.email?.trim().toLowerCase() === email) {
        return rep.parentesco;
      }
    }

    throw new NotFoundException('El estudiante no está vinculado a este apoderado');
  }

  private buildCursosSeguimiento(grades: Grade[]): CursoSeguimiento[] {
    const byCurso = new Map<string, Grade[]>();
    for (const grade of grades) {
      const list = byCurso.get(grade.curso) ?? [];
      list.push(grade);
      byCurso.set(grade.curso, list);
    }

    return [...byCurso.entries()].map(([curso, items]) => {
      const b1 = avgBimestre(items, 1);
      const b2 = avgBimestre(items, 2);
      const b3 = avgBimestre(items, 3);
      const b4 = avgBimestre(items, 4);
      const bimAvgs = [b1, b2, b3, b4].filter((v): v is number => v !== null);
      const promedio = bimAvgs.length
        ? round2(bimAvgs.reduce((s, v) => s + v, 0) / bimAvgs.length)
        : null;

      return {
        curso,
        promedio,
        nivel: promedio !== null ? nivelFromNota(promedio) : null,
        b1,
        b2,
        b3,
        b4,
        ultimasNotas: items
          .slice()
          .sort((a, b) => b.fechaEvaluacion.localeCompare(a.fechaEvaluacion))
          .slice(0, 5)
          .map(g => ({
            id: g.id,
            descripcion: g.descripcion ?? g.tipo,
            nota: g.nota,
            fecha: g.fechaEvaluacion,
            bimestre: g.bimestre,
            tipo: g.tipo,
          })),
      };
    });
  }

  private toHijoResumen(
    student: {
      id: number;
      nombre: string;
      apellido: string;
      nivel: string;
      grado: string;
      seccion: string;
    },
    parentesco: string,
  ): HijoResumen {
    return {
      studentId: student.id,
      nombre: student.nombre,
      apellido: student.apellido,
      nombreCompleto: `${student.nombre} ${student.apellido}`,
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      aulaLabel: `${student.nivel} · ${student.grado} ${student.seccion}`,
      parentesco,
    };
  }
}

function avgBimestre(items: Grade[], bimestre: number): number | null {
  const filtered = items.filter(g => g.bimestre === bimestre);
  if (!filtered.length) return null;
  return round2(filtered.reduce((s, g) => s + Number(g.nota), 0) / filtered.length);
}

function round2(value: number): number {
  return Math.round(value * 10) / 10;
}

function nivelFromNota(nota: number): string {
  if (nota >= 17.5) return 'AD';
  if (nota >= 14) return 'A';
  if (nota >= 11) return 'B';
  return 'C';
}
