import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AUDIT_LOG_RETENTION_DAYS } from '../audit-logs/audit-logs.constants';
import { Institution } from '../institution/entities/institution.entity';
import { MailService } from '../mail/mail.service';
import {
  StudentSensitiveNotificationContext,
  StudentSensitiveNotificationResponse,
} from './dto/student-sensitive-notification.dto';
import { StudentAuditContext } from './dto/student-change-audit.dto';
import { StudentSensitiveNotification } from './entities/student-sensitive-notification.entity';
import { Student } from './entities/student.entity';
import {
  extractSensitiveChanges,
  sensitiveFieldLabels,
} from './student-change-diff.util';
import {
  isSensitiveNotificationEnabled,
  SENSITIVE_FIELD_LABELS,
  SENSITIVE_PERSONAL_FIELDS,
} from './student-sensitive.constants';

@Injectable()
export class StudentSensitiveNotificationService {
  private readonly logger = new Logger(StudentSensitiveNotificationService.name);

  constructor(
    @InjectRepository(StudentSensitiveNotification)
    private readonly notifRepo: Repository<StudentSensitiveNotification>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly mailService: MailService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<StudentSensitiveNotificationContext> {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(this.institutionRepo.create({}));
    }
    return {
      institucion: {
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolar: Number(institution.anio) || new Date().getFullYear(),
        ugel: institution.ugel,
        dre: institution.dre,
      },
      retencionDias: AUDIT_LOG_RETENTION_DAYS,
      permisoConsulta: 'estudiantes.expediente',
      notificacionesActivas: isSensitiveNotificationEnabled(),
      camposSensibles: SENSITIVE_PERSONAL_FIELDS.map((campo) => ({
        campo,
        label: SENSITIVE_FIELD_LABELS[campo] ?? campo,
      })),
    };
  }

  async processSensitiveChanges(
    student: Student,
    changeLogId: number,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: StudentAuditContext,
  ): Promise<StudentSensitiveNotification | null> {
    const sensitive = extractSensitiveChanges(cambios);
    const campos = Object.keys(sensitive);
    if (!campos.length) return null;

    const existing = await this.notifRepo.findOne({
      where: { studentChangeLogId: changeLogId },
    });
    if (existing) return existing;

    const req = ctx?.req;
    const actor = req
      ? parseActorFromRequest(req)
      : { usuarioId: null, usuarioNombre: 'Sistema', usuarioRol: '' };
    const correlationId = req ? getCorrelationId(req) : null;
    const ip = req ? getClientIp(req) : '';

    const parentEmail = this.mailService.resolveParentEmail(student) ?? '';
    let correoEnviado = false;

    if (isSensitiveNotificationEnabled() && parentEmail) {
      try {
        const result = await this.mailService.sendStudentPersonalDataChangeNotification({
          student,
          camposLabels: sensitiveFieldLabels(campos),
          actorNombre: actor.usuarioNombre,
          motivo: ctx?.motivo?.trim() || 'Actualización de datos personales',
        });
        correoEnviado = result?.sent === true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `No se pudo enviar notificación de datos sensibles (estudiante ${student.id}): ${message}`,
        );
      }
    }

    const saved = await this.notifRepo.save(
      this.notifRepo.create({
        studentChangeLogId: changeLogId,
        studentId: student.id,
        studentNombre: `${student.apellido}, ${student.nombre}`.trim(),
        studentCodigo: student.codigo || String(student.id),
        camposNotificados: campos,
        correoDestino: parentEmail,
        correoEnviado,
        canal: 'email',
        actorNombre: actor.usuarioNombre,
        actorRol: actor.usuarioRol,
        motivo: ctx?.motivo?.trim() || 'Actualización de datos personales',
        correlationId,
        ip,
      }),
    );

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'matricula',
      entidad: 'notificacion_datos_sensibles',
      entidadId: String(saved.id),
      descripcion: `Notificación de cambio en datos personales — estudiante ${student.id}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      detalle: {
        studentId: student.id,
        campos,
        correoEnviado,
        correoDestino: parentEmail ? maskEmailForLog(parentEmail) : '',
      },
    });

    return saved;
  }

  async findAll(filters?: {
    studentId?: number;
    correoEnviado?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: StudentSensitiveNotificationResponse[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));
    const qb = this.applyFilters(
      this.notifRepo.createQueryBuilder('n'),
      filters,
    );

    const [rows, totalItems] = await qb
      .orderBy('n.createdAt', 'DESC')
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

  async findOne(id: number): Promise<StudentSensitiveNotificationResponse> {
    const row = await this.notifRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Notificación ${id} no encontrada`);
    }
    return this.toResponse(row);
  }

  logConsultation(req: Request, accion: 'listar' | 'detalle', entidadId?: string): void {
    const actor = parseActorFromRequest(req);
    this.auditLogger.log({
      accion: 'consultar',
      modulo: 'matricula',
      entidad: 'notificacion_datos_sensibles',
      entidadId: entidadId ?? undefined,
      descripcion:
        accion === 'listar'
          ? 'Consultó registro de notificaciones de datos personales'
          : `Consultó detalle de notificación de datos personales #${entidadId}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
      resultado: 'success',
    });
  }

  private applyFilters(
    qb: SelectQueryBuilder<StudentSensitiveNotification>,
    filters?: {
      studentId?: number;
      correoEnviado?: string;
      desde?: string;
      hasta?: string;
      busqueda?: string;
    },
  ): SelectQueryBuilder<StudentSensitiveNotification> {
    if (filters?.studentId) {
      qb.andWhere('n.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.correoEnviado === 'true') {
      qb.andWhere('n.correoEnviado = true');
    }
    if (filters?.correoEnviado === 'false') {
      qb.andWhere('n.correoEnviado = false');
    }
    if (filters?.desde) {
      qb.andWhere('n.createdAt >= :desde', { desde: `${filters.desde}T00:00:00` });
    }
    if (filters?.hasta) {
      qb.andWhere('n.createdAt <= :hasta', { hasta: `${filters.hasta}T23:59:59` });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(n.studentNombre ILIKE :q OR n.studentCodigo ILIKE :q OR n.motivo ILIKE :q)',
        { q },
      );
    }
    return qb;
  }

  private toResponse(
    row: StudentSensitiveNotification,
  ): StudentSensitiveNotificationResponse {
    const fecha = row.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: row.id,
      studentChangeLogId: row.studentChangeLogId,
      studentId: row.studentId,
      studentNombre: row.studentNombre,
      studentCodigo: row.studentCodigo,
      camposNotificados: row.camposNotificados,
      camposLabels: sensitiveFieldLabels(row.camposNotificados),
      correoDestino: maskEmailForLog(row.correoDestino),
      correoEnviado: row.correoEnviado,
      canal: row.canal,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      motivo: row.motivo,
      correlationId: row.correlationId,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
      fechaDisplay: `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`,
      horaDisplay: `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`,
    };
  }
}

function maskEmailForLog(email: string): string {
  const v = email.trim();
  if (!v) return '';
  const at = v.indexOf('@');
  if (at <= 1) return '[redactado]';
  return `${v[0]}***${v.slice(at)}`;
}
