import { Injectable, NotFoundException } from '@nestjs/common';
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
import {
  StudentChangeAuditContext,
  StudentChangeLogResponse,
  StudentAuditContext,
} from './dto/student-change-audit.dto';
import {
  StudentChangeAccion,
  StudentChangeLog,
} from './entities/student-change-log.entity';
import { Student } from './entities/student.entity';
import {
  diffStudentSnapshots,
  snapshotStudent,
} from './student-change-diff.util';
import { StudentSensitiveNotificationService } from './student-sensitive-notification.service';

@Injectable()
export class StudentChangeAuditService {
  constructor(
    @InjectRepository(StudentChangeLog)
    private readonly logRepo: Repository<StudentChangeLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly auditLogger: AuditLoggerService,
    private readonly sensitiveNotification: StudentSensitiveNotificationService,
  ) {}

  async getContext(): Promise<StudentChangeAuditContext> {
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
      permisoExportacion: 'estudiantes.exportar',
    };
  }

  async recordCreate(
    student: Student,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    const after = snapshotStudent(student);
    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
    for (const [key, value] of Object.entries(after)) {
      cambios[key] = { nuevo: value };
    }
    await this.persist(student, 'crear', cambios, ctx);
  }

  async recordUpdate(
    student: Student,
    before: Student,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    const cambios = diffStudentSnapshots(
      snapshotStudent(before),
      snapshotStudent(student),
    );
    if (!cambios) return;
    await this.persist(student, 'actualizar', cambios, ctx);
  }

  async recordDelete(
    student: Student,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    const before = snapshotStudent(student);
    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
    for (const [key, value] of Object.entries(before)) {
      cambios[key] = { anterior: value };
    }
    await this.persist(student, 'eliminar', cambios, ctx);
  }

  async recordSectionChange(
    student: Student,
    seccionAnterior: string,
    seccionNueva: string,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    await this.persist(
      student,
      'cambio_seccion',
      {
        seccion: { anterior: seccionAnterior, nuevo: seccionNueva },
      },
      ctx,
    );
  }

  async recordWithdrawal(
    student: Student,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    await this.persist(student, 'retiro', cambios, ctx);
  }

  async recordReadmission(
    student: Student,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    await this.persist(student, 'reingreso', cambios, ctx);
  }

  async findAll(filters?: {
    studentId?: number;
    accion?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    resultado?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: StudentChangeLogResponse[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));
    const qb = this.applyFilters(this.logRepo.createQueryBuilder('log'), filters);

    const [rows, totalItems] = await qb
      .orderBy('log.createdAt', 'DESC')
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

  async findByStudent(studentId: number, page = 1, pageSize = 50) {
    return this.findAll({ studentId, page, pageSize });
  }

  async findOne(id: number): Promise<StudentChangeLogResponse> {
    const row = await this.logRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Registro de auditoría ${id} no encontrado`);
    }
    return this.toResponse(row);
  }

  async exportCsv(filters?: {
    studentId?: number;
    accion?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    resultado?: string;
  }): Promise<string> {
    const qb = this.applyFilters(this.logRepo.createQueryBuilder('log'), filters);
    const rows = await qb.orderBy('log.createdAt', 'DESC').take(5000).getMany();
    const header = [
      'id',
      'fecha',
      'hora',
      'studentId',
      'estudiante',
      'accion',
      'actor',
      'rol',
      'resultado',
      'motivo',
      'ip',
      'correlationId',
      'cambios',
    ].join(',');

    const lines = rows.map((row) => {
      const r = this.toResponse(row);
      return [
        r.id,
        r.fechaDisplay,
        r.horaDisplay,
        r.studentId,
        csvCell(r.studentNombre),
        r.accion,
        csvCell(r.actorNombre),
        csvCell(r.actorRol),
        r.resultado,
        csvCell(r.motivo),
        csvCell(r.ip),
        csvCell(r.correlationId ?? ''),
        csvCell(JSON.stringify(r.cambios)),
      ].join(',');
    });

    return '\uFEFF' + [header, ...lines].join('\n');
  }

  private async persist(
    student: Student,
    accion: StudentChangeAccion,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: StudentAuditContext,
  ): Promise<void> {
    const req = ctx?.req;
    const actor = req ? parseActorFromRequest(req) : {
      usuarioId: null,
      usuarioNombre: 'Sistema',
      usuarioRol: '',
    };

    const correlationId = req ? getCorrelationId(req) : null;
    const ip = req ? getClientIp(req) : '';

    if (correlationId) {
      const dup = await this.logRepo.findOne({
        where: {
          studentId: student.id,
          accion,
          correlationId,
        },
      });
      if (dup) return;
    }

    const saved = await this.logRepo.save(
      this.logRepo.create({
        studentId: student.id,
        studentCodigo: student.codigo || String(student.id),
        studentNombre: `${student.apellido}, ${student.nombre}`.trim(),
        accion,
        actorUserId: actor.usuarioId,
        actorNombre: actor.usuarioNombre,
        actorRol: actor.usuarioRol,
        motivo: ctx?.motivo?.trim() || defaultMotivo(accion),
        cambios,
        ip,
        correlationId,
        resultado: 'success',
      }),
    );

    this.auditLogger.log({
      accion: accion === 'eliminar' ? 'eliminar' : 'actualizar',
      modulo: 'matricula',
      entidad: 'estudiante',
      entidadId: String(student.id),
      institutionId: student.institutionId,
      descripcion: `Auditoría de datos de estudiante — ${accion}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      detalle: {
        studentChangeLogId: saved.id,
        accion,
        campos: Object.keys(cambios),
        motivo: saved.motivo,
      },
    });

    if (accion === 'actualizar' || accion === 'crear') {
      try {
        await this.sensitiveNotification.processSensitiveChanges(
          student,
          saved.id,
          cambios,
          ctx,
        );
      } catch {
        /* La auditoría principal ya quedó registrada; no revertir por fallo de notificación. */
      }
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<StudentChangeLog>,
    filters?: {
      studentId?: number;
      accion?: string;
      usuario?: string;
      desde?: string;
      hasta?: string;
      busqueda?: string;
      resultado?: string;
    },
  ): SelectQueryBuilder<StudentChangeLog> {
    if (filters?.studentId) {
      qb.andWhere('log.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.accion) {
      qb.andWhere('log.accion = :accion', { accion: filters.accion });
    }
    if (filters?.resultado) {
      qb.andWhere('log.resultado = :resultado', { resultado: filters.resultado });
    }
    if (filters?.usuario?.trim()) {
      qb.andWhere(
        '(log.actorNombre ILIKE :usuario OR log.actorRol ILIKE :usuario OR log.studentNombre ILIKE :usuario)',
        { usuario: `%${filters.usuario.trim()}%` },
      );
    }
    if (filters?.desde) {
      qb.andWhere('log.createdAt >= :desde', { desde: `${filters.desde}T00:00:00` });
    }
    if (filters?.hasta) {
      qb.andWhere('log.createdAt <= :hasta', { hasta: `${filters.hasta}T23:59:59` });
    }
    if (filters?.busqueda?.trim()) {
      const q = `%${filters.busqueda.trim()}%`;
      qb.andWhere(
        '(log.studentNombre ILIKE :q OR log.studentCodigo ILIKE :q OR log.motivo ILIKE :q OR log."correlationId" ILIKE :q)',
        { q },
      );
    }
    return qb;
  }

  private toResponse(row: StudentChangeLog): StudentChangeLogResponse {
    const fecha = row.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: row.id,
      studentId: row.studentId,
      studentCodigo: row.studentCodigo,
      studentNombre: row.studentNombre,
      accion: row.accion,
      actorUserId: row.actorUserId,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      motivo: row.motivo,
      cambios: row.cambios,
      ip: row.ip,
      correlationId: row.correlationId,
      resultado: row.resultado,
      createdAt: row.createdAt.toISOString(),
      fechaDisplay: `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`,
      horaDisplay: `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`,
    };
  }
}

function defaultMotivo(accion: StudentChangeAccion): string {
  const map: Record<StudentChangeAccion, string> = {
    crear: 'Registro de estudiante',
    actualizar: 'Actualización de datos del estudiante',
    eliminar: 'Eliminación de estudiante',
    cambio_seccion: 'Cambio de sección',
    retiro: 'Retiro de matrícula vigente',
    reingreso: 'Reingreso de matrícula retirada',
  };
  return map[accion];
}

function csvCell(value: string): string {
  const v = value.replace(/"/g, '""');
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
}
