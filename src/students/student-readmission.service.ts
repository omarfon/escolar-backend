import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Grade } from '../grades/entities/grade.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { SalonesService } from '../maestros/salones/salones.service';
import {
  CreateStudentReadmissionDto,
  StudentReadmissionContext,
  StudentReadmissionEligibility,
  StudentReadmissionListResponse,
  StudentReadmissionResponse,
} from './dto/student-readmission.dto';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { StudentReadmission } from './entities/student-readmission.entity';
import { StudentWithdrawal } from './entities/student-withdrawal.entity';
import { Student } from './entities/student.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import {
  MOTIVOS_REINGRESO,
  PERMISO_REINGRESO_CONSULTAR,
  PERMISO_REINGRESO_REGISTRAR,
  REINGRESO_AUTORIZACION_MIN,
} from './student-readmission.constants';
import {
  resolveFechaReingresoContextWindow,
  resolveFechaReingresoWindow,
  validateFechaReingreso,
} from './student-readmission.util';
import { todayIso } from './student-withdrawal.util';

@Injectable()
export class StudentReadmissionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(StudentReadmission)
    private readonly readmissionRepo: Repository<StudentReadmission>,
    @InjectRepository(StudentWithdrawal)
    private readonly withdrawalRepo: Repository<StudentWithdrawal>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(StudentAcademicHistory)
    private readonly historyRepo: Repository<StudentAcademicHistory>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly salonesService: SalonesService,
    private readonly studentChangeAudit: StudentChangeAuditService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<StudentReadmissionContext> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const window = await this.buildContextWindow(anioEscolar);
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar,
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
        codigoModular: institution.codigoModular ?? '',
      },
      permisoRegistrar: PERMISO_REINGRESO_REGISTRAR,
      permisoConsultar: PERMISO_REINGRESO_CONSULTAR,
      motivos: MOTIVOS_REINGRESO,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
    };
  }

  async getEligibility(
    studentId: number,
  ): Promise<StudentReadmissionEligibility> {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { studentId, anioEscolar },
    });
    const existing = await this.readmissionRepo.findOne({
      where: { studentId, anioEscolar },
    });
    const vacantes = withdrawal
      ? await this.countVacantes(
          student.nivel,
          student.grado,
          student.seccion,
          anioEscolar,
        )
      : 0;

    let motivoInelegible: string | null = null;
    if (existing) {
      motivoInelegible = `Ya existe un reingreso registrado para el año ${anioEscolar}`;
    } else if (student.estadoMatricula !== 'retirado') {
      motivoInelegible = 'El estudiante no tiene matrícula retirada';
    } else if (!withdrawal) {
      motivoInelegible =
        'No existe un retiro previo válido para el año escolar vigente';
    } else if (vacantes <= 0) {
      motivoInelegible = `No hay vacante disponible en ${student.grado} "${student.seccion}"`;
    }

    const window = withdrawal
      ? await this.buildReingresoWindow(anioEscolar, withdrawal.fechaRetiro)
      : await this.buildContextWindow(anioEscolar);

    return {
      studentId: student.id,
      studentCodigo: student.codigo || String(student.id),
      studentNombre: `${student.apellido}, ${student.nombre}`.trim(),
      nivel: student.nivel,
      grado: student.grado,
      seccion: student.seccion,
      estadoMatricula: student.estadoMatricula,
      anioEscolar,
      elegible: !motivoInelegible,
      motivoInelegible,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
      withdrawalId: withdrawal?.id ?? null,
      fechaRetiro: withdrawal?.fechaRetiro ?? null,
      vacantesDisponibles: vacantes,
      reingresoExistenteId: existing?.id ?? null,
    };
  }

  async findAll(filters?: {
    studentId?: number;
    anioEscolar?: number;
    busqueda?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }): Promise<StudentReadmissionListResponse> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.readmissionRepo.createQueryBuilder('r');

    if (filters?.studentId) {
      qb.andWhere('r.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.anioEscolar) {
      qb.andWhere('r.anioEscolar = :anio', { anio: filters.anioEscolar });
    }
    if (filters?.desde) {
      qb.andWhere('r.fechaReingreso >= :desde', { desde: filters.desde });
    }
    if (filters?.hasta) {
      qb.andWhere('r.fechaReingreso <= :hasta', { hasta: filters.hasta });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(r.studentNombre ILIKE :q OR r.studentCodigo ILIKE :q OR r.motivo ILIKE :q)',
        { q },
      );
    }

    const [rows, totalItems] = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.toResponse(row)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }

  async findOne(id: number): Promise<StudentReadmissionResponse> {
    const row = await this.readmissionRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Reingreso ${id} no encontrado`);
    }
    return this.toResponse(row);
  }

  async register(
    studentId: number,
    dto: CreateStudentReadmissionDto,
    req?: Request,
  ): Promise<StudentReadmissionResponse> {
    const motivo = dto.motivo?.trim();
    const autorizacion = dto.autorizacion?.trim();
    if (
      !motivo ||
      !MOTIVOS_REINGRESO.includes(motivo as (typeof MOTIVOS_REINGRESO)[number])
    ) {
      throw new BadRequestException(
        'Debe indicar un motivo de reingreso válido',
      );
    }
    if (!autorizacion || autorizacion.length < REINGRESO_AUTORIZACION_MIN) {
      throw new BadRequestException(
        `La autorización es obligatoria (mínimo ${REINGRESO_AUTORIZACION_MIN} caracteres)`,
      );
    }

    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }

    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const correlationId = req ? getCorrelationId(req) : null;

    if (correlationId) {
      const byCorr = await this.readmissionRepo.findOne({
        where: { studentId, anioEscolar, correlationId },
      });
      if (byCorr) {
        return this.toResponse(byCorr, true);
      }
    }

    const existing = await this.readmissionRepo.findOne({
      where: { studentId, anioEscolar },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un reingreso registrado para este estudiante en el año ${anioEscolar}`,
      );
    }

    const withdrawal = await this.withdrawalRepo.findOne({
      where: { studentId, anioEscolar },
    });
    if (!withdrawal) {
      throw new BadRequestException(
        'No existe un retiro previo válido para registrar el reingreso',
      );
    }

    if (student.estadoMatricula !== 'retirado') {
      throw new BadRequestException(
        'Solo se puede registrar el reingreso de un estudiante con matrícula retirada',
      );
    }

    const window = await this.buildReingresoWindow(
      anioEscolar,
      withdrawal.fechaRetiro,
    );
    const fechaError = validateFechaReingreso(dto.fechaReingreso, window);
    if (fechaError) {
      throw new BadRequestException(fechaError);
    }

    const vacantesPrevias = await this.countVacantes(
      student.nivel,
      student.grado,
      student.seccion,
      anioEscolar,
    );
    if (vacantesPrevias <= 0) {
      throw new BadRequestException(
        `No hay vacante disponible en ${student.grado} "${student.seccion}"`,
      );
    }

    const actor = req
      ? parseActorFromRequest(req)
      : { usuarioId: null, usuarioNombre: 'Sistema', usuarioRol: '' };
    const ip = req ? getClientIp(req) : '';

    const notasConservadas = await this.gradeRepo.count({
      where: { studentId },
    });
    const asistenciasConservadas = await this.attendanceRepo.count({
      where: { studentId },
    });

    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {
      estadoMatricula: { anterior: student.estadoMatricula, nuevo: 'activo' },
      activo: { anterior: student.activo, nuevo: true },
      fechaReingreso: { nuevo: dto.fechaReingreso },
      motivo: { nuevo: motivo },
      withdrawalId: { nuevo: withdrawal.id },
    };

    const saved = await this.dataSource.transaction(async (manager) => {
      const studentTx = manager.getRepository(Student);
      const readmissionTx = manager.getRepository(StudentReadmission);
      const historyTx = manager.getRepository(StudentAcademicHistory);

      const locked = await studentTx.findOne({
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
      }
      if (locked.estadoMatricula !== 'retirado') {
        throw new BadRequestException(
          'Solo se puede registrar el reingreso de un estudiante con matrícula retirada',
        );
      }

      const dup = await readmissionTx.findOne({
        where: { studentId, anioEscolar },
      });
      if (dup) {
        throw new ConflictException(
          `Ya existe un reingreso registrado para este estudiante en el año ${anioEscolar}`,
        );
      }

      const vacantes = await this.countVacantes(
        locked.nivel,
        locked.grado,
        locked.seccion,
        anioEscolar,
      );
      if (vacantes <= 0) {
        throw new BadRequestException(
          `No hay vacante disponible en ${locked.grado} "${locked.seccion}"`,
        );
      }

      locked.estadoMatricula = 'activo';
      locked.activo = true;
      await studentTx.save(locked);

      const anioKey = String(anioEscolar);
      let history = await historyTx.findOne({
        where: { studentId, anio: anioKey },
      });
      if (history) {
        history.estado = 'Matriculado';
        history.grado = locked.grado;
        history.seccion = locked.seccion;
        await historyTx.save(history);
      } else {
        history = await historyTx.save(
          historyTx.create({
            studentId,
            anio: anioKey,
            grado: locked.grado,
            seccion: locked.seccion,
            promedio: 0,
            estado: 'Matriculado',
          }),
        );
      }

      const vacantesDespues = await this.countVacantes(
        locked.nivel,
        locked.grado,
        locked.seccion,
        anioEscolar,
      );

      return readmissionTx.save(
        readmissionTx.create({
          studentId,
          studentCodigo: locked.codigo || String(locked.id),
          studentNombre: `${locked.apellido}, ${locked.nombre}`.trim(),
          anioEscolar,
          withdrawalId: withdrawal.id,
          nivel: locked.nivel,
          grado: locked.grado,
          seccion: locked.seccion,
          fechaReingreso: dto.fechaReingreso,
          fechaRetiroVinculada: withdrawal.fechaRetiro,
          motivo,
          autorizacion,
          estado: 'registrado',
          actorUserId: actor.usuarioId,
          actorNombre: actor.usuarioNombre,
          actorRol: actor.usuarioRol,
          cambios,
          ip,
          correlationId,
          notasConservadas,
          asistenciasConservadas,
          vacantesDisponiblesDespues: vacantesDespues,
        }),
      );
    });

    await this.studentChangeAudit.recordReadmission(student, cambios, {
      req,
      motivo: `${motivo}. ${autorizacion}`.slice(0, 500),
    });

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'matricula',
      entidad: 'reingreso_estudiante',
      entidadId: String(saved.id),
      descripcion: `Reingreso registrado — ${saved.studentNombre} (${saved.studentCodigo})`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      nivel: 'info',
      detalle: {
        studentId,
        anioEscolar,
        withdrawalId: withdrawal.id,
        fechaReingreso: dto.fechaReingreso,
        motivo,
        estadoAnterior: 'retirado',
        estadoNuevo: 'activo',
        notasConservadas,
        asistenciasConservadas,
        vacantesDisponiblesDespues: saved.vacantesDisponiblesDespues,
      },
    });

    return this.toResponse(saved);
  }

  private async buildContextWindow(anioEscolar: number) {
    const periodos = await this.periodosService.findAll({
      anioEscolar,
      activo: true,
    });
    const inicios = periodos
      .map((p) => p.inicio)
      .filter(Boolean)
      .sort();
    const fines = periodos
      .map((p) => p.fin)
      .filter(Boolean)
      .sort();
    return resolveFechaReingresoContextWindow({
      anioEscolar,
      periodoInicio: inicios[0] ?? null,
      periodoFin: fines.at(-1) ?? null,
      hoy: todayIso(),
    });
  }

  private async buildReingresoWindow(anioEscolar: number, fechaRetiro: string) {
    const periodos = await this.periodosService.findAll({
      anioEscolar,
      activo: true,
    });
    const fines = periodos
      .map((p) => p.fin)
      .filter(Boolean)
      .sort();
    return resolveFechaReingresoWindow({
      fechaRetiro,
      anioEscolar,
      periodoFin: fines.at(-1) ?? null,
      hoy: todayIso(),
    });
  }

  private async countVacantes(
    nivel: string,
    grado: string,
    seccion: string,
    anioEscolar: number,
  ): Promise<number> {
    const occupancy = await this.salonesService.getSectionOccupancy(
      nivel,
      grado,
      anioEscolar,
    );
    const sec = seccion.trim().toUpperCase();
    const item = occupancy.find((o) => o.seccion === sec);
    return item?.disponibles ?? 0;
  }

  private async requireInstitution(): Promise<Institution> {
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

  private toResponse(
    row: StudentReadmission,
    duplicadoIdempotente = false,
  ): StudentReadmissionResponse {
    return {
      id: row.id,
      studentId: row.studentId,
      studentCodigo: row.studentCodigo,
      studentNombre: row.studentNombre,
      anioEscolar: row.anioEscolar,
      withdrawalId: row.withdrawalId,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion,
      fechaReingreso: row.fechaReingreso,
      fechaRetiroVinculada: row.fechaRetiroVinculada,
      motivo: row.motivo,
      autorizacion: row.autorizacion,
      estado: row.estado,
      actorUserId: row.actorUserId,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      cambios: row.cambios,
      ip: row.ip,
      correlationId: row.correlationId,
      notasConservadas: row.notasConservadas,
      asistenciasConservadas: row.asistenciasConservadas,
      vacantesDisponiblesDespues: row.vacantesDisponiblesDespues,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      duplicadoIdempotente: duplicadoIdempotente || undefined,
    };
  }
}
