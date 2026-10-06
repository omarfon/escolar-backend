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
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import {
  CreateEnrollmentFeedbackDto,
  EnrollmentFeedbackContext,
  EnrollmentFeedbackEligibility,
  EnrollmentFeedbackListResponse,
  EnrollmentFeedbackResponse,
} from './dto/enrollment-feedback.dto';
import { EnrollmentFeedback } from './entities/enrollment-feedback.entity';
import {
  CANALES_RETROALIMENTACION,
  PERMISO_RETROALIMENTACION_CONSULTAR,
  PERMISO_RETROALIMENTACION_REGISTRAR,
  RETROALIMENTACION_MENSAJE_MIN,
} from './enrollment-feedback.constants';
import {
  resolveFechaRetroalimentacionWindow,
  validateFechaRetroalimentacion,
} from './enrollment-feedback.util';
import { todayIso } from '../students/student-withdrawal.util';

@Injectable()
export class EnrollmentFeedbackService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(EnrollmentFeedback)
    private readonly feedbackRepo: Repository<EnrollmentFeedback>,
    @InjectRepository(EnrollmentEvaluation)
    private readonly evaluationRepo: Repository<EnrollmentEvaluation>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<EnrollmentFeedbackContext> {
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
      permisoRegistrar: PERMISO_RETROALIMENTACION_REGISTRAR,
      permisoConsultar: PERMISO_RETROALIMENTACION_CONSULTAR,
      canales: CANALES_RETROALIMENTACION,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
    };
  }

  async getEligibility(
    evaluationId: number,
  ): Promise<EnrollmentFeedbackEligibility> {
    const evaluation = await this.evaluationRepo.findOneBy({
      id: evaluationId,
    });
    if (!evaluation) {
      throw new NotFoundException(`Evaluación ${evaluationId} no encontrada`);
    }

    const existing = await this.feedbackRepo.findOne({
      where: { enrollmentEvaluationId: evaluationId },
    });
    const window = await this.buildDateWindow(evaluation.anioEscolar);

    let motivoInelegible: string | null = null;
    if (existing) {
      motivoInelegible =
        'Ya existe una retroalimentación registrada para esta evaluación';
    }

    return {
      enrollmentEvaluationId: evaluation.id,
      candidatoNombre: evaluation.candidatoNombre,
      candidatoDni: evaluation.candidatoDni,
      tipoEvaluacion: evaluation.tipoEvaluacion,
      resultadoEvaluacion: evaluation.resultado,
      anioEscolar: evaluation.anioEscolar,
      elegible: !motivoInelegible,
      motivoInelegible,
      fechaMin: window.fechaMin,
      fechaMax: window.fechaMax,
      retroalimentacionExistenteId: existing?.id ?? null,
    };
  }

  async findAll(filters?: {
    enrollmentEvaluationId?: number;
    anioEscolar?: number;
    busqueda?: string;
    page?: number;
    pageSize?: number;
  }): Promise<EnrollmentFeedbackListResponse> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 20));
    const qb = this.feedbackRepo.createQueryBuilder('f');

    if (filters?.enrollmentEvaluationId) {
      qb.andWhere('f.enrollmentEvaluationId = :evalId', {
        evalId: filters.enrollmentEvaluationId,
      });
    }
    if (filters?.anioEscolar) {
      qb.andWhere('f.anioEscolar = :anio', { anio: filters.anioEscolar });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(f.candidatoNombre ILIKE :q OR f.candidatoDni ILIKE :q OR f.destinatario ILIKE :q OR f.mensaje ILIKE :q)',
        { q },
      );
    }

    const [rows, totalItems] = await qb
      .orderBy('f.createdAt', 'DESC')
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

  async findOne(id: number): Promise<EnrollmentFeedbackResponse> {
    const row = await this.feedbackRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Retroalimentación ${id} no encontrada`);
    }
    return this.toResponse(row);
  }

  async register(
    dto: CreateEnrollmentFeedbackDto,
    req?: Request,
  ): Promise<EnrollmentFeedbackResponse> {
    const canal = dto.canal?.trim();
    if (
      !canal ||
      !CANALES_RETROALIMENTACION.includes(
        canal as (typeof CANALES_RETROALIMENTACION)[number],
      )
    ) {
      throw new BadRequestException('Debe indicar un canal válido');
    }

    const mensaje = dto.mensaje?.trim();
    const destinatario = dto.destinatario?.trim();
    if (!mensaje || mensaje.length < RETROALIMENTACION_MENSAJE_MIN) {
      throw new BadRequestException(
        `El mensaje es obligatorio (mínimo ${RETROALIMENTACION_MENSAJE_MIN} caracteres)`,
      );
    }
    if (!destinatario) {
      throw new BadRequestException('Debe indicar el destinatario');
    }

    const evaluation = await this.evaluationRepo.findOneBy({
      id: dto.enrollmentEvaluationId,
    });
    if (!evaluation) {
      throw new NotFoundException(
        `Evaluación ${dto.enrollmentEvaluationId} no encontrada`,
      );
    }

    const eligibility = await this.getEligibility(dto.enrollmentEvaluationId);
    if (!eligibility.elegible) {
      throw new BadRequestException(
        eligibility.motivoInelegible ?? 'No es elegible para retroalimentación',
      );
    }

    const window = await this.buildDateWindow(evaluation.anioEscolar);
    const fechaError = validateFechaRetroalimentacion(
      dto.fechaRetroalimentacion,
      window,
    );
    if (fechaError) {
      throw new BadRequestException(fechaError);
    }

    const correlationId = req ? getCorrelationId(req) : null;
    if (correlationId) {
      const byCorr = await this.feedbackRepo.findOne({
        where: { correlationId },
      });
      if (byCorr) {
        return this.toResponse(byCorr, true);
      }
    }

    const actor = req
      ? parseActorFromRequest(req)
      : { usuarioId: null, usuarioNombre: 'Sistema', usuarioRol: '' };
    const ip = req ? getClientIp(req) : '';

    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {
      canal: { nuevo: canal },
      fechaRetroalimentacion: { nuevo: dto.fechaRetroalimentacion },
      destinatario: { nuevo: destinatario },
      mensaje: { nuevo: mensaje },
      acuseRecibo: { nuevo: dto.acuseRecibo ?? false },
      enrollmentEvaluationId: { nuevo: evaluation.id },
    };

    const saved = await this.dataSource.transaction(async (manager) => {
      const feedbackTx = manager.getRepository(EnrollmentFeedback);

      const dup = await feedbackTx.findOne({
        where: { enrollmentEvaluationId: evaluation.id },
      });
      if (dup) {
        throw new ConflictException(
          'Ya existe una retroalimentación para esta evaluación',
        );
      }

      return feedbackTx.save(
        feedbackTx.create({
          anioEscolar: evaluation.anioEscolar,
          enrollmentEvaluationId: evaluation.id,
          waitlistEntryId: evaluation.waitlistEntryId,
          studentId: evaluation.studentId,
          candidatoNombre: evaluation.candidatoNombre,
          candidatoDni: evaluation.candidatoDni,
          tipoEvaluacion: evaluation.tipoEvaluacion,
          resultadoEvaluacion: evaluation.resultado,
          canal: canal as EnrollmentFeedback['canal'],
          fechaRetroalimentacion: dto.fechaRetroalimentacion,
          destinatario,
          mensaje,
          acuseRecibo: dto.acuseRecibo ?? false,
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
      entidad: 'retroalimentacion_matricula',
      entidadId: String(saved.id),
      descripcion: `Retroalimentación registrada — ${saved.candidatoNombre} (${canal})`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      nivel: 'info',
      detalle: {
        enrollmentEvaluationId: evaluation.id,
        canal,
        destinatario,
        anioEscolar: evaluation.anioEscolar,
      },
    });

    return this.toResponse(saved);
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
    return resolveFechaRetroalimentacionWindow({
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
    row: EnrollmentFeedback,
    duplicadoIdempotente = false,
  ): EnrollmentFeedbackResponse {
    return {
      id: row.id,
      anioEscolar: row.anioEscolar,
      enrollmentEvaluationId: row.enrollmentEvaluationId,
      waitlistEntryId: row.waitlistEntryId,
      studentId: row.studentId,
      candidatoNombre: row.candidatoNombre,
      candidatoDni: row.candidatoDni,
      tipoEvaluacion: row.tipoEvaluacion,
      resultadoEvaluacion: row.resultadoEvaluacion,
      canal: row.canal,
      fechaRetroalimentacion: row.fechaRetroalimentacion,
      destinatario: row.destinatario,
      mensaje: row.mensaje,
      acuseRecibo: row.acuseRecibo,
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
