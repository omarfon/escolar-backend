import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { Student } from '../students/entities/student.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import {
  CreateEnrollmentEvaluationDto,
  EnrollmentEvaluationContext,
  EnrollmentEvaluationEligibility,
  EnrollmentEvaluationListResponse,
  EnrollmentEvaluationResponse,
} from './dto/enrollment-evaluation.dto';
import { EnrollmentEvaluation } from './entities/enrollment-evaluation.entity';
import {
  EVALUACION_RESOLUCION_MIN,
  PERMISO_EVALUACION_MATRICULA_CONSULTAR,
  PERMISO_EVALUACION_MATRICULA_REGISTRAR,
  RESULTADO_EVALUACION_LABELS,
  RESULTADOS_EVALUACION_MATRICULA,
  TIPOS_EVALUACION_MATRICULA,
} from './enrollment-evaluation.constants';
import {
  resolveFechaEvaluacionWindow,
  validateFechaEvaluacion,
} from './enrollment-evaluation.util';
import { todayIso } from '../students/student-withdrawal.util';

@Injectable()
export class EnrollmentEvaluationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(EnrollmentEvaluation)
    private readonly evaluationRepo: Repository<EnrollmentEvaluation>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<EnrollmentEvaluationContext> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const window = await this.buildDateWindow(anioEscolar);
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar,
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
        codigoModular: institution.codigoModular ?? '',
      },
      permisoRegistrar: PERMISO_EVALUACION_MATRICULA_REGISTRAR,
      permisoConsultar: PERMISO_EVALUACION_MATRICULA_CONSULTAR,
      tiposEvaluacion: TIPOS_EVALUACION_MATRICULA,
      resultados: RESULTADOS_EVALUACION_MATRICULA,
      resultadoLabels: RESULTADO_EVALUACION_LABELS,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
    };
  }

  async getWaitlistEligibility(
    waitlistEntryId: number,
  ): Promise<EnrollmentEvaluationEligibility> {
    const entry = await this.waitlistRepo.findOneBy({ id: waitlistEntryId });
    if (!entry) {
      throw new NotFoundException(
        `Solicitud de lista de espera ${waitlistEntryId} no encontrada`,
      );
    }
    return this.buildEligibility('waitlist', {
      waitlistEntryId: entry.id,
      studentId: entry.studentId,
      candidatoNombre: `${entry.apellidos}, ${entry.nombres}`.trim(),
      candidatoDni: entry.dni,
      nivel: entry.nivel,
      grado: entry.grado,
      seccionDeseada: entry.seccionDeseada,
      estadoWaitlist: entry.estado,
    });
  }

  async getStudentEligibility(
    studentId: number,
  ): Promise<EnrollmentEvaluationEligibility> {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Estudiante ${studentId} no encontrado`);
    }
    return this.buildEligibility('estudiante', {
      waitlistEntryId: null,
      studentId: student.id,
      candidatoNombre: `${student.apellido}, ${student.nombre}`.trim(),
      candidatoDni: student.dni ?? '',
      nivel: student.nivel,
      grado: student.grado,
      seccionDeseada: student.seccion,
      estadoMatricula: student.estadoMatricula,
    });
  }

  async findAll(filters?: {
    waitlistEntryId?: number;
    studentId?: number;
    anioEscolar?: number;
    resultado?: string;
    tipoEvaluacion?: string;
    busqueda?: string;
    page?: number;
    pageSize?: number;
  }): Promise<EnrollmentEvaluationListResponse> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.evaluationRepo.createQueryBuilder('e');

    if (filters?.waitlistEntryId) {
      qb.andWhere('e.waitlistEntryId = :waitlistEntryId', {
        waitlistEntryId: filters.waitlistEntryId,
      });
    }
    if (filters?.studentId) {
      qb.andWhere('e.studentId = :studentId', {
        studentId: filters.studentId,
      });
    }
    if (filters?.anioEscolar) {
      qb.andWhere('e.anioEscolar = :anio', { anio: filters.anioEscolar });
    }
    if (filters?.resultado) {
      qb.andWhere('e.resultado = :resultado', { resultado: filters.resultado });
    }
    if (filters?.tipoEvaluacion) {
      qb.andWhere('e.tipoEvaluacion = :tipo', {
        tipo: filters.tipoEvaluacion,
      });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(e.candidatoNombre ILIKE :q OR e.candidatoDni ILIKE :q OR e.tipoEvaluacion ILIKE :q)',
        { q },
      );
    }

    const [rows, totalItems] = await qb
      .orderBy('e.createdAt', 'DESC')
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

  async findOne(id: number): Promise<EnrollmentEvaluationResponse> {
    const row = await this.evaluationRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(
        `Evaluación de matrícula ${id} no encontrada`,
      );
    }
    return this.toResponse(row);
  }

  async register(
    dto: CreateEnrollmentEvaluationDto,
    req?: Request,
  ): Promise<EnrollmentEvaluationResponse> {
    const waitlistEntryId = dto.waitlistEntryId ?? null;
    const studentId = dto.studentId ?? null;

    if ((!waitlistEntryId && !studentId) || (waitlistEntryId && studentId)) {
      throw new BadRequestException(
        'Debe indicar waitlistEntryId o studentId, pero no ambos',
      );
    }

    const tipo = dto.tipoEvaluacion?.trim();
    if (
      !tipo ||
      !TIPOS_EVALUACION_MATRICULA.includes(
        tipo as (typeof TIPOS_EVALUACION_MATRICULA)[number],
      )
    ) {
      throw new BadRequestException(
        'Debe indicar un tipo de evaluación válido',
      );
    }

    const resultado = dto.resultado?.trim();
    if (
      !resultado ||
      !RESULTADOS_EVALUACION_MATRICULA.includes(
        resultado as (typeof RESULTADOS_EVALUACION_MATRICULA)[number],
      )
    ) {
      throw new BadRequestException('Debe indicar un resultado válido');
    }

    const resolucion = dto.resolucion?.trim();
    if (!resolucion || resolucion.length < EVALUACION_RESOLUCION_MIN) {
      throw new BadRequestException(
        `La resolución es obligatoria (mínimo ${EVALUACION_RESOLUCION_MIN} caracteres)`,
      );
    }

    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const correlationId = req ? getCorrelationId(req) : null;

    if (correlationId) {
      const byCorr = await this.evaluationRepo.findOne({
        where: { correlationId },
      });
      if (byCorr) {
        return this.toResponse(byCorr, true);
      }
    }

    const eligibility = waitlistEntryId
      ? await this.getWaitlistEligibility(waitlistEntryId)
      : await this.getStudentEligibility(studentId!);

    if (!eligibility.elegible) {
      throw new BadRequestException(
        eligibility.motivoInelegible ?? 'El candidato no es elegible',
      );
    }

    if (!eligibility.tiposDisponibles.includes(tipo)) {
      throw new ConflictException(
        `Ya existe una evaluación de tipo "${tipo}" para este candidato en el año ${anioEscolar}`,
      );
    }

    const window = await this.buildDateWindow(anioEscolar);
    const fechaError = validateFechaEvaluacion(dto.fechaEvaluacion, window);
    if (fechaError) {
      throw new BadRequestException(fechaError);
    }

    const actor = req
      ? parseActorFromRequest(req)
      : { usuarioId: null, usuarioNombre: 'Sistema', usuarioRol: '' };
    const ip = req ? getClientIp(req) : '';

    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {
      tipoEvaluacion: { nuevo: tipo },
      fechaEvaluacion: { nuevo: dto.fechaEvaluacion },
      resultado: { nuevo: resultado },
      puntaje: { nuevo: dto.puntaje ?? null },
      resolucion: { nuevo: resolucion },
    };

    const saved = await this.dataSource.transaction(async (manager) => {
      const evalTx = manager.getRepository(EnrollmentEvaluation);

      if (waitlistEntryId) {
        const dup = await evalTx.findOne({
          where: {
            waitlistEntryId,
            tipoEvaluacion: tipo as EnrollmentEvaluation['tipoEvaluacion'],
            anioEscolar,
          },
        });
        if (dup) {
          throw new ConflictException(
            `Ya existe una evaluación de tipo "${tipo}" para esta solicitud en el año ${anioEscolar}`,
          );
        }
      } else {
        const dup = await evalTx.findOne({
          where: {
            studentId: studentId!,
            tipoEvaluacion: tipo as EnrollmentEvaluation['tipoEvaluacion'],
            anioEscolar,
          },
        });
        if (dup) {
          throw new ConflictException(
            `Ya existe una evaluación de tipo "${tipo}" para este estudiante en el año ${anioEscolar}`,
          );
        }
      }

      return evalTx.save(
        evalTx.create({
          anioEscolar,
          origen: waitlistEntryId ? 'waitlist' : 'estudiante',
          waitlistEntryId,
          studentId,
          candidatoNombre: eligibility.candidatoNombre,
          candidatoDni: eligibility.candidatoDni,
          nivel: eligibility.nivel,
          grado: eligibility.grado,
          seccionDeseada: eligibility.seccionDeseada,
          tipoEvaluacion: tipo as EnrollmentEvaluation['tipoEvaluacion'],
          fechaEvaluacion: dto.fechaEvaluacion,
          resultado: resultado as EnrollmentEvaluation['resultado'],
          puntaje: dto.puntaje ?? null,
          observaciones: dto.observaciones?.trim() ?? '',
          resolucion,
          estado: 'registrado',
          actorUserId: actor.usuarioId,
          actorNombre: actor.usuarioNombre,
          actorRol: actor.usuarioRol,
          cambios,
          ip,
          correlationId,
        }),
      );
    });

    this.auditLogger.log({
      accion: 'crear',
      modulo: 'matricula',
      entidad: 'evaluacion_matricula',
      entidadId: String(saved.id),
      descripcion: `Evaluación de matrícula registrada — ${saved.candidatoNombre} (${tipo})`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      nivel: 'info',
      detalle: {
        origen: saved.origen,
        waitlistEntryId: saved.waitlistEntryId,
        studentId: saved.studentId,
        tipoEvaluacion: tipo,
        resultado,
        anioEscolar,
      },
    });

    return this.toResponse(saved);
  }

  private async buildEligibility(
    origen: 'waitlist' | 'estudiante',
    data: {
      waitlistEntryId: number | null;
      studentId: number | null;
      candidatoNombre: string;
      candidatoDni: string;
      nivel: string;
      grado: string;
      seccionDeseada: string;
      estadoWaitlist?: WaitlistEntry['estado'];
      estadoMatricula?: Student['estadoMatricula'];
    },
  ): Promise<EnrollmentEvaluationEligibility> {
    const institution = await this.requireInstitution();
    const anioEscolar = Number(institution.anio) || new Date().getFullYear();
    const window = await this.buildDateWindow(anioEscolar);

    const existing = await this.evaluationRepo.find({
      where:
        origen === 'waitlist' && data.waitlistEntryId
          ? { waitlistEntryId: data.waitlistEntryId, anioEscolar }
          : { studentId: data.studentId!, anioEscolar },
    });
    const tiposRegistrados = existing.map((e) => e.tipoEvaluacion);
    const tiposDisponibles = TIPOS_EVALUACION_MATRICULA.filter(
      (t) => !tiposRegistrados.includes(t),
    );

    let motivoInelegible: string | null = null;
    if (origen === 'waitlist') {
      if (
        data.estadoWaitlist !== 'en_espera' &&
        data.estadoWaitlist !== 'notificado'
      ) {
        motivoInelegible =
          'Solo se evalúan solicitudes en lista de espera activas (en espera o notificadas)';
      }
    } else if (data.estadoMatricula === 'retirado') {
      motivoInelegible =
        'No se evalúa a estudiantes con matrícula retirada desde este módulo';
    }

    if (!motivoInelegible && tiposDisponibles.length === 0) {
      motivoInelegible = `Ya se registraron todos los tipos de evaluación para el año ${anioEscolar}`;
    }

    return {
      origen,
      waitlistEntryId: data.waitlistEntryId,
      studentId: data.studentId,
      candidatoNombre: data.candidatoNombre,
      candidatoDni: data.candidatoDni,
      nivel: data.nivel,
      grado: data.grado,
      seccionDeseada: data.seccionDeseada,
      anioEscolar,
      elegible: !motivoInelegible,
      motivoInelegible,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
      tiposRegistrados,
      tiposDisponibles: [...tiposDisponibles],
    };
  }

  private async buildDateWindow(anioEscolar: number) {
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
    return resolveFechaEvaluacionWindow({
      anioEscolar,
      periodoInicio: inicios[0] ?? null,
      periodoFin: fines.at(-1) ?? null,
      hoy: todayIso(),
    });
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
    row: EnrollmentEvaluation,
    duplicadoIdempotente = false,
  ): EnrollmentEvaluationResponse {
    return {
      id: row.id,
      anioEscolar: row.anioEscolar,
      origen: row.origen,
      waitlistEntryId: row.waitlistEntryId,
      studentId: row.studentId,
      candidatoNombre: row.candidatoNombre,
      candidatoDni: row.candidatoDni,
      nivel: row.nivel,
      grado: row.grado,
      seccionDeseada: row.seccionDeseada,
      tipoEvaluacion: row.tipoEvaluacion,
      fechaEvaluacion: row.fechaEvaluacion,
      resultado: row.resultado,
      puntaje: row.puntaje != null ? Number(row.puntaje) : null,
      observaciones: row.observaciones,
      resolucion: row.resolucion,
      estado: row.estado,
      actorUserId: row.actorUserId,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      cambios: row.cambios,
      ip: row.ip,
      correlationId: row.correlationId,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      duplicadoIdempotente: duplicadoIdempotente || undefined,
    };
  }
}
