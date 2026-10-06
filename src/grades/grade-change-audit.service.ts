import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  GradeAuditContext,
  GradeAuditStudentMeta,
  GradeChangeAuditContext,
  GradeChangeLogResponse,
} from './dto/grade-change-audit.dto';
import {
  GradeChangeAccion,
  GradeChangeLog,
} from './entities/grade-change-log.entity';
import { Grade } from './entities/grade.entity';
import { diffGradeSnapshots, snapshotGrade } from './grade-change-diff.util';

@Injectable()
export class GradeChangeAuditService {
  constructor(
    @InjectRepository(GradeChangeLog)
    private readonly logRepo: Repository<GradeChangeLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(): Promise<GradeChangeAuditContext> {
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
      permisoConsulta: 'evaluacion.reportes',
      permisoExportacion: 'evaluacion.exportar',
    };
  }

  async recordCreate(
    grade: Grade,
    student: GradeAuditStudentMeta,
    ctx?: GradeAuditContext,
  ): Promise<void> {
    const after = snapshotGrade(grade);
    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
    for (const [key, value] of Object.entries(after)) {
      cambios[key] = { nuevo: value };
    }
    await this.persist(grade, student, 'crear', cambios, ctx);
  }

  async recordUpdate(
    grade: Grade,
    before: Grade,
    student: GradeAuditStudentMeta,
    ctx?: GradeAuditContext,
  ): Promise<void> {
    const cambios = diffGradeSnapshots(
      snapshotGrade(before),
      snapshotGrade(grade),
    );
    if (!cambios) return;
    await this.persist(grade, student, 'actualizar', cambios, ctx);
  }

  async recordDelete(
    grade: Grade,
    student: GradeAuditStudentMeta,
    ctx?: GradeAuditContext,
  ): Promise<void> {
    const before = snapshotGrade(grade);
    const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
    for (const [key, value] of Object.entries(before)) {
      cambios[key] = { anterior: value };
    }
    await this.persist(grade, student, 'eliminar', cambios, ctx);
  }

  async recordRectify(
    grade: Grade,
    before: Grade,
    student: GradeAuditStudentMeta,
    ctx?: GradeAuditContext,
  ): Promise<void> {
    const cambios = diffGradeSnapshots(
      snapshotGrade(before),
      snapshotGrade(grade),
    );
    if (!cambios) return;
    await this.persist(grade, student, 'rectificar', cambios, ctx);
  }

  async findAll(filters?: {
    studentId?: number;
    gradeId?: number;
    curso?: string;
    bimestre?: number;
    accion?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    resultado?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: GradeChangeLogResponse[];
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

  async findByGrade(gradeId: number, page = 1, pageSize = 50) {
    return this.findAll({ gradeId, page, pageSize });
  }

  async findOne(id: number): Promise<GradeChangeLogResponse> {
    const row = await this.logRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Registro de auditoría ${id} no encontrado`);
    }
    return this.toResponse(row);
  }

  async exportCsv(filters?: {
    studentId?: number;
    gradeId?: number;
    curso?: string;
    bimestre?: number;
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
      'gradeId',
      'studentId',
      'estudiante',
      'curso',
      'componente',
      'bimestre',
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
        r.gradeId ?? '',
        r.studentId,
        csvCell(r.studentNombre),
        csvCell(r.curso),
        csvCell(r.componenteCodigo),
        r.bimestre,
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
    grade: Grade,
    student: GradeAuditStudentMeta,
    accion: GradeChangeAccion,
    cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
    ctx?: GradeAuditContext,
  ): Promise<void> {
    const req = ctx?.req;
    const actor = req
      ? parseActorFromRequest(req)
      : {
          usuarioId: null,
          usuarioNombre: 'Sistema',
          usuarioRol: '',
        };

    const correlationId = req ? getCorrelationId(req) : null;
    const ip = req ? getClientIp(req) : '';

    if (correlationId) {
      const dup = await this.logRepo.findOne({
        where: {
          gradeId: grade.id,
          accion,
          correlationId,
        },
      });
      if (dup) return;
    }

    const saved = await this.logRepo.save(
      this.logRepo.create({
        gradeId: grade.id ?? null,
        studentId: grade.studentId,
        studentCodigo: student.studentCodigo,
        studentNombre: student.studentNombre,
        curso: grade.curso,
        componenteCodigo: grade.componenteCodigo,
        bimestre: grade.bimestre,
        nivel: ctx?.nivel?.trim() ?? '',
        grado: ctx?.grado?.trim() ?? '',
        seccion: ctx?.seccion?.trim() ?? '',
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
      accion:
        accion === 'eliminar'
          ? 'eliminar'
          : accion === 'rectificar'
            ? 'actualizar'
            : 'actualizar',
      modulo: 'evaluacion',
      entidad: 'nota',
      entidadId: String(grade.id ?? grade.studentId),
      descripcion: `Auditoría de nota — ${accion}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip,
      correlationId: correlationId ?? undefined,
      resultado: 'success',
      detalle: {
        gradeChangeLogId: saved.id,
        accion,
        curso: grade.curso,
        bimestre: grade.bimestre,
        componenteCodigo: grade.componenteCodigo,
        campos: Object.keys(cambios),
        motivo: saved.motivo,
      },
    });
  }

  private applyFilters(
    qb: SelectQueryBuilder<GradeChangeLog>,
    filters?: {
      studentId?: number;
      gradeId?: number;
      curso?: string;
      bimestre?: number;
      accion?: string;
      usuario?: string;
      desde?: string;
      hasta?: string;
      busqueda?: string;
      resultado?: string;
    },
  ): SelectQueryBuilder<GradeChangeLog> {
    if (filters?.studentId) {
      qb.andWhere('log.studentId = :studentId', { studentId: filters.studentId });
    }
    if (filters?.gradeId) {
      qb.andWhere('log.gradeId = :gradeId', { gradeId: filters.gradeId });
    }
    if (filters?.curso?.trim()) {
      qb.andWhere('log.curso = :curso', { curso: filters.curso.trim() });
    }
    if (filters?.bimestre) {
      qb.andWhere('log.bimestre = :bimestre', { bimestre: filters.bimestre });
    }
    if (filters?.accion) {
      qb.andWhere('log.accion = :accion', { accion: filters.accion });
    }
    if (filters?.resultado) {
      qb.andWhere('log.resultado = :resultado', { resultado: filters.resultado });
    }
    if (filters?.usuario?.trim()) {
      qb.andWhere(
        '(log.actorNombre ILIKE :usuario OR log.actorRol ILIKE :usuario OR log.studentNombre ILIKE :usuario OR log.curso ILIKE :usuario)',
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
        '(log.studentNombre ILIKE :q OR log.studentCodigo ILIKE :q OR log.curso ILIKE :q OR log."componenteCodigo" ILIKE :q OR log.motivo ILIKE :q OR log."correlationId" ILIKE :q)',
        { q },
      );
    }
    return qb;
  }

  private toResponse(row: GradeChangeLog): GradeChangeLogResponse {
    const fecha = row.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: row.id,
      gradeId: row.gradeId,
      studentId: row.studentId,
      studentCodigo: row.studentCodigo,
      studentNombre: row.studentNombre,
      curso: row.curso,
      componenteCodigo: row.componenteCodigo,
      bimestre: row.bimestre,
      nivel: row.nivel,
      grado: row.grado,
      seccion: row.seccion,
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

function defaultMotivo(accion: GradeChangeAccion): string {
  const map: Record<GradeChangeAccion, string> = {
    crear: 'Registro de nota',
    actualizar: 'Actualización de nota',
    eliminar: 'Eliminación de nota',
    registro_masivo: 'Registro masivo de notas',
    rectificar: 'Rectificación oficial de nota',
  };
  return map[accion];
}

function csvCell(value: string): string {
  const v = value.replace(/"/g, '""');
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
}
