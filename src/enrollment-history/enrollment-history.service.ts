import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { ContinuityEnrollment } from '../continuity-enrollment/entities/continuity-enrollment.entity';
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { EnrollmentFeedback } from '../enrollment-feedback/entities/enrollment-feedback.entity';
import { Institution } from '../institution/entities/institution.entity';
import { SectionChange } from '../students/entities/section-change.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { StudentReadmission } from '../students/entities/student-readmission.entity';
import { StudentWithdrawal } from '../students/entities/student-withdrawal.entity';
import { Student } from '../students/entities/student.entity';
import { TransferRequestEvent } from '../transfers/entities/transfer-request-event.entity';
import { TransferRequest } from '../transfers/entities/transfer-request.entity';
import { StudentsService } from '../students/students.service';
import type { EnrollmentHistoryActorContext } from './enrollment-history-actor.interface';
import {
  eventosHistorialDesdeTraslados,
  trasladoVisibleEnHistorial,
} from './enrollment-history-traslado.util';
import {
  MatriculaHistorialContext,
  MatriculaHistorialDetalle,
  MatriculaHistorialEvento,
  MatriculaHistorialListResponse,
} from './dto/enrollment-history.dto';
import {
  EVENTO_MATRICULA_LABELS,
  PERMISO_HISTORIAL_MATRICULA,
  PERMISO_HISTORIAL_MATRICULA_CONSULTAR,
} from './enrollment-history.constants';

@Injectable()
export class EnrollmentHistoryService {
  constructor(
    private readonly auditLogger: AuditLoggerService,
    private readonly studentsService: StudentsService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    @InjectRepository(StudentWithdrawal)
    private readonly withdrawalRepo: Repository<StudentWithdrawal>,
    @InjectRepository(StudentReadmission)
    private readonly readmissionRepo: Repository<StudentReadmission>,
    @InjectRepository(SectionChange)
    private readonly sectionChangeRepo: Repository<SectionChange>,
    @InjectRepository(ContinuityEnrollment)
    private readonly continuityRepo: Repository<ContinuityEnrollment>,
    @InjectRepository(EnrollmentEvaluation)
    private readonly evaluationRepo: Repository<EnrollmentEvaluation>,
    @InjectRepository(EnrollmentFeedback)
    private readonly feedbackRepo: Repository<EnrollmentFeedback>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(TransferRequest)
    private readonly transferRepo: Repository<TransferRequest>,
    @InjectRepository(TransferRequestEvent)
    private readonly transferEventRepo: Repository<TransferRequestEvent>,
  ) {}

  async getContext(
    req?: Request & { user?: RequestUser },
  ): Promise<MatriculaHistorialContext> {
    const institutionId = institutionIdDeAlcance(req?.user, req);
    if (esSuperusuarioSiagie(req?.user) && institutionId === undefined) {
      return {
        institucion: {
          nombre: '',
          siglas: '',
          anioEscolar: new Date().getFullYear(),
          ugel: '',
          dre: '',
          codigoModular: '',
        },
        permisoConsultar: PERMISO_HISTORIAL_MATRICULA_CONSULTAR,
        tiposEvento: Object.entries(EVENTO_MATRICULA_LABELS).map(
          ([codigo, label]) => ({ codigo, label }),
        ),
      };
    }
    const institution = await this.requireInstitution(institutionId);
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar,
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
        codigoModular: institution.codigoModular ?? '',
      },
      permisoConsultar: PERMISO_HISTORIAL_MATRICULA_CONSULTAR,
      tiposEvento: Object.entries(EVENTO_MATRICULA_LABELS).map(
        ([codigo, label]) => ({ codigo, label }),
      ),
    };
  }

  async findAll(
    search?: string,
    page = 1,
    pageSize = 20,
    req?: Request & { user?: RequestUser },
  ): Promise<MatriculaHistorialListResponse> {
    const institutionId = institutionIdDeAlcance(req?.user, req);
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    if (esSuperusuarioSiagie(req?.user) && institutionId === undefined) {
      return { items: [], total: 0, page: safePage, pageSize: safeSize };
    }
    const result = await this.studentsService.findHistorialAcademicoPage(
      search,
      safePage,
      safeSize,
      institutionId,
    );
    return { items: result.items, total: result.total, page: result.page, pageSize: result.pageSize };
  }

  async findOne(
    studentId: number,
    ctx?: EnrollmentHistoryActorContext,
  ): Promise<MatriculaHistorialDetalle> {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    const institutionId = ctx?.institutionId ?? undefined;
    if (
      institutionId != null &&
      institutionId > 0 &&
      student.institutionId !== institutionId
    ) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    const institution = await this.requireInstitution(institutionId);

    const [academico, historial, withdrawals, readmissions, sectionChanges, continuity, evaluations, feedbacks, traslados] =
      await Promise.all([
        this.studentsService.findHistorialAcademicoDetalle(studentId),
        this.historyRepo.find({
          where: { studentId },
          order: { anio: 'ASC' },
        }),
        this.withdrawalRepo.find({
          where: { studentId },
          order: { fechaRetiro: 'ASC' },
        }),
        this.readmissionRepo.find({
          where: { studentId },
          order: { fechaReingreso: 'ASC' },
        }),
        this.sectionChangeRepo.find({
          where: { studentId, estado: 'completado' },
          order: { createdAt: 'ASC' },
        }),
        this.continuityRepo.find({
          where: { studentId },
          order: { fechaGeneracion: 'ASC' },
        }),
        this.evaluationRepo.find({
          where: { studentId },
          order: { fechaEvaluacion: 'ASC' },
        }),
        this.feedbackRepo
          .createQueryBuilder('f')
          .where('f.studentId = :studentId', { studentId })
          .orderBy('f.fechaRetroalimentacion', 'ASC')
          .getMany(),
        this.transferRepo.find({
          where: { studentId },
          order: { createdAt: 'ASC' },
        }),
      ]);

    const trasladosVisibles = traslados.filter((t) =>
      trasladoVisibleEnHistorial(t, institution, {
        esAdmin: ctx?.esAdmin ?? false,
        ambitos: ctx?.ambitos ?? ['MINEDU'],
      }),
    );

    const transferIds = trasladosVisibles.map((t) => t.id);
    const eventosFiltrados =
      transferIds.length > 0
        ? await this.transferEventRepo
            .createQueryBuilder('e')
            .where('e."transferRequestId" IN (:...ids)', { ids: transferIds })
            .orderBy('e."createdAt"', 'ASC')
            .getMany()
        : [];

    const eventosPorTraslado = new Map<number, TransferRequestEvent[]>();

    for (const event of eventosFiltrados) {
      const list = eventosPorTraslado.get(event.transferRequestId) ?? [];
      list.push(event);
      eventosPorTraslado.set(event.transferRequestId, list);
    }

    const eventos: MatriculaHistorialEvento[] = [];

    for (const h of historial) {
      eventos.push({
        id: `matricula-${h.id}`,
        tipo: 'matricula',
        fecha: `${h.anio}-03-01`,
        titulo: EVENTO_MATRICULA_LABELS.matricula,
        descripcion: `${h.grado} sección "${h.seccion}" — ${h.estado}`,
        metadata: {
          anio: h.anio,
          grado: h.grado,
          seccion: h.seccion,
          promedio: h.promedio,
          estado: h.estado,
        },
      });
    }

    for (const w of withdrawals) {
      eventos.push({
        id: `retiro-${w.id}`,
        tipo: 'retiro',
        fecha: w.fechaRetiro,
        titulo: EVENTO_MATRICULA_LABELS.retiro,
        descripcion: `${w.motivo}. ${w.grado} "${w.seccion}"`,
        actorNombre: w.actorNombre,
        actorRol: w.actorRol,
        metadata: { withdrawalId: w.id, anioEscolar: w.anioEscolar },
      });
    }

    for (const r of readmissions) {
      eventos.push({
        id: `reingreso-${r.id}`,
        tipo: 'reingreso',
        fecha: r.fechaReingreso,
        titulo: EVENTO_MATRICULA_LABELS.reingreso,
        descripcion: `${r.motivo}. Vinculado a retiro del ${r.fechaRetiroVinculada}`,
        actorNombre: r.actorNombre,
        actorRol: r.actorRol,
        metadata: {
          readmissionId: r.id,
          withdrawalId: r.withdrawalId,
          anioEscolar: r.anioEscolar,
        },
      });
    }

    for (const sc of sectionChanges) {
      const fecha = sc.createdAt.toISOString().slice(0, 10);
      eventos.push({
        id: `cambio-seccion-${sc.id}`,
        tipo: 'cambio_seccion',
        fecha,
        titulo: EVENTO_MATRICULA_LABELS.cambio_seccion,
        descripcion: `"${sc.seccionAnterior}" → "${sc.seccionNueva}". ${sc.motivo}`,
        actorNombre: sc.realizadoPor,
        metadata: { sectionChangeId: sc.id, anioEscolar: sc.anioEscolar },
      });
    }

    for (const c of continuity) {
      const fecha = c.fechaGeneracion.toISOString().slice(0, 10);
      eventos.push({
        id: `continuidad-${c.id}`,
        tipo: 'continuidad',
        fecha,
        titulo: EVENTO_MATRICULA_LABELS.continuidad,
        descripcion: `${c.anioAnterior}→${c.anioNuevo}: ${c.gradoAnterior} "${c.seccionAnterior}" → ${c.gradoNuevo} "${c.seccionNueva}" (${c.situacion}, ${c.estado})`,
        metadata: { continuityId: c.id, situacion: c.situacion, estado: c.estado },
      });
    }

    for (const ev of evaluations) {
      eventos.push({
        id: `evaluacion-${ev.id}`,
        tipo: 'evaluacion',
        fecha: ev.fechaEvaluacion,
        titulo: EVENTO_MATRICULA_LABELS.evaluacion,
        descripcion: `${ev.tipoEvaluacion}: ${ev.resultado}`,
        actorNombre: ev.actorNombre,
        actorRol: ev.actorRol,
        metadata: { evaluationId: ev.id, puntaje: ev.puntaje },
      });
    }

    for (const fb of feedbacks) {
      eventos.push({
        id: `retroalimentacion-${fb.id}`,
        tipo: 'retroalimentacion',
        fecha: fb.fechaRetroalimentacion,
        titulo: EVENTO_MATRICULA_LABELS.retroalimentacion,
        descripcion: `Canal ${fb.canal} — ${fb.destinatario}`,
        actorNombre: fb.actorNombre,
        actorRol: fb.actorRol,
        metadata: {
          feedbackId: fb.id,
          evaluationId: fb.enrollmentEvaluationId,
          acuseRecibo: fb.acuseRecibo,
        },
      });
    }

    eventos.push(...eventosHistorialDesdeTraslados(trasladosVisibles, eventosPorTraslado));

    eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    return {
      estudiante: {
        id: student.id,
        codigo: student.codigo,
        nombres: student.nombre,
        apellidos: student.apellido,
        dni: student.dni,
        nivel: student.nivel,
        gradoActual: student.grado,
        seccionActual: student.seccion,
        anioIngreso: student.anioIngreso,
        estadoMatricula: student.estadoMatricula,
        activo: student.activo,
      },
      resumen: {
        aniosRegistrados: historial.length,
        eventosTotal: eventos.length,
        asistenciaPct: academico.asistenciaPct,
        promedioGeneral: academico.resumenNotas.promedioGeneral,
      },
      trayectoriaAcademica: academico.trayectoria,
      eventosMatricula: eventos,
    };
  }

  logConsultation(
    req: Request,
    accion: 'listar' | 'detalle',
    entidadId?: string,
  ): void {
    this.auditLogger.logFromRequestContext(req, {
      accion: 'consultar',
      modulo: 'matricula',
      entidad: 'historial_matricula',
      entidadId: entidadId ?? undefined,
      descripcion:
        accion === 'listar'
          ? 'Consultó listado de historial de matrícula'
          : `Consultó historial de matrícula del estudiante #${entidadId}`,
      resultado: 'success',
    });
  }

  private async requireInstitution(
    institutionId?: number | null,
  ): Promise<Institution> {
    if (institutionId != null && institutionId > 0) {
      const byId = await this.institutionRepo.findOneBy({ id: institutionId });
      if (byId) return byId;
      throw new NotFoundException(
        `Institución educativa ${institutionId} no encontrada`,
      );
    }
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(
        this.institutionRepo.create({}),
      );
    }
    return institution;
  }
}
