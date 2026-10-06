import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Institution } from '../institution/entities/institution.entity';
import { AUDIT_LOG_RETENTION_DAYS } from './audit-logs.constants';
import { CreateAuditLogDto } from './dto/audit-log.dto';
import {
  AuditAccion,
  AuditLog,
  AuditNivel,
  AuditResultado,
} from './entities/audit-log.entity';

export interface AuditLogResponse {
  id: number;
  usuarioId: number | null;
  usuarioNombre: string;
  usuarioRol: string;
  accion: AuditAccion;
  modulo: string;
  entidad: string;
  entidadId: string | null;
  descripcion: string;
  detalle: Record<string, unknown> | null;
  ip: string;
  nivel: AuditNivel;
  resultado: AuditResultado;
  correlationId: string | null;
  createdAt: string;
  fechaDisplay: string;
  horaDisplay: string;
}

export interface AuditLogResumen {
  total: number;
  hoy: number;
  criticos: number;
  advertencias: number;
  accesos: number;
  accesosFallidos: number;
  porModulo: { modulo: string; total: number }[];
}

export interface AuditLogPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditLogListResult {
  resumen: AuditLogResumen;
  items: AuditLogResponse[];
  pagination: AuditLogPagination;
}

export interface AuditLogContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
  permisoExportacion: string;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  /** Solo uso interno del servidor — la API no expone creación manual. */
  async create(dto: CreateAuditLogDto): Promise<AuditLogResponse> {
    const saved = await this.auditRepo.save(
      this.auditRepo.create({
        usuarioId: dto.usuarioId ?? null,
        usuarioNombre: dto.usuarioNombre?.trim() ?? 'Sistema',
        usuarioRol: dto.usuarioRol?.trim() ?? '',
        institutionId: dto.institutionId ?? null,
        accion: dto.accion as AuditAccion,
        modulo: dto.modulo.trim(),
        entidad: dto.entidad.trim(),
        entidadId: dto.entidadId ?? null,
        descripcion: dto.descripcion.trim(),
        detalle: dto.detalle ?? null,
        ip: dto.ip?.trim() ?? '',
        nivel: (dto.nivel as AuditNivel) ?? 'info',
        resultado: (dto.resultado as AuditResultado) ?? 'success',
        correlationId: dto.correlationId?.trim() || null,
      }),
    );
    return this.toResponse(saved);
  }

  async createMany(dtos: CreateAuditLogDto[]): Promise<void> {
    if (!dtos.length) return;
    const entities = dtos.map((dto) =>
      this.auditRepo.create({
        usuarioId: dto.usuarioId ?? null,
        usuarioNombre: dto.usuarioNombre?.trim() ?? 'Sistema',
        usuarioRol: dto.usuarioRol?.trim() ?? '',
        institutionId: dto.institutionId ?? null,
        accion: dto.accion as AuditAccion,
        modulo: dto.modulo.trim(),
        entidad: dto.entidad.trim(),
        entidadId: dto.entidadId ?? null,
        descripcion: dto.descripcion.trim(),
        detalle: dto.detalle ?? null,
        ip: dto.ip?.trim() ?? '',
        nivel: (dto.nivel as AuditNivel) ?? 'info',
        resultado: (dto.resultado as AuditResultado) ?? 'success',
        correlationId: dto.correlationId?.trim() || null,
      }),
    );
    await this.auditRepo.save(entities);
  }

  assertAppendOnlyApi(): void {
    throw new ForbiddenException(
      'Los registros de auditoría son de solo append; no pueden crearse ni modificarse vía API.',
    );
  }

  async getContext(institutionId?: number): Promise<AuditLogContext> {
    let institution: Institution | null = null;
    if (institutionId != null && institutionId > 0) {
      institution = await this.institutionRepo.findOneBy({ id: institutionId });
    }
    if (!institution) {
      institution = await this.institutionRepo.findOne({
        where: {},
        order: { id: 'ASC' },
      });
    }
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
      permisoConsulta: 'admin.reportes',
      permisoExportacion: 'admin.reportes',
    };
  }

  async findAll(filters?: {
    institutionId?: number;
    modulo?: string;
    accion?: string;
    nivel?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    tipo?: string;
    resultado?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AuditLogListResult> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));

    const qb = this.applyFilters(
      this.auditRepo.createQueryBuilder('log'),
      filters,
    );

    const resumenQb = this.applyFilters(
      this.auditRepo.createQueryBuilder('log'),
      filters,
    );

    const [rows, totalItems] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const resumen = await this.buildResumenSql(resumenQb);

    return {
      resumen,
      items: rows.map((row) => this.toResponse(row)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }

  async exportCsv(filters?: {
    institutionId?: number;
    modulo?: string;
    accion?: string;
    nivel?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    tipo?: string;
    resultado?: string;
  }): Promise<string> {
    const qb = this.applyFilters(
      this.auditRepo.createQueryBuilder('log'),
      filters,
    );
    const rows = await qb.orderBy('log.createdAt', 'DESC').take(5000).getMany();

    const header = [
      'id',
      'fecha',
      'hora',
      'usuario',
      'rol',
      'accion',
      'modulo',
      'entidad',
      'resultado',
      'nivel',
      'ip',
      'correlationId',
      'descripcion',
    ].join(',');

    const lines = rows.map((log) => {
      const r = this.toResponse(log);
      return [
        r.id,
        r.fechaDisplay,
        r.horaDisplay,
        csvCell(r.usuarioNombre),
        csvCell(r.usuarioRol),
        r.accion,
        r.modulo,
        r.entidad,
        r.resultado,
        r.nivel,
        csvCell(r.ip),
        csvCell(r.correlationId ?? ''),
        csvCell(r.descripcion),
      ].join(',');
    });

    return '\uFEFF' + [header, ...lines].join('\n');
  }

  async findOne(id: number, institutionId?: number): Promise<AuditLogResponse> {
    const log = await this.auditRepo.findOneBy({ id });
    if (!log) throw new NotFoundException(`Registro de bitácora ${id} no encontrado`);
    if (institutionId != null && log.institutionId !== institutionId) {
      throw new NotFoundException(`Registro de bitácora ${id} no encontrado`);
    }
    return this.toResponse(log);
  }

  /** Elimina registros más antiguos que el periodo de retención. */
  async purgeExpired(
    retentionDays = AUDIT_LOG_RETENTION_DAYS,
  ): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.auditRepo
      .createQueryBuilder()
      .delete()
      .from(AuditLog)
      .where('"createdAt" < :cutoff', { cutoff })
      .execute();

    return result.affected ?? 0;
  }

  private applyFilters(
    qb: SelectQueryBuilder<AuditLog>,
    filters?: {
      institutionId?: number;
      modulo?: string;
      accion?: string;
      nivel?: string;
      usuario?: string;
      desde?: string;
      hasta?: string;
      busqueda?: string;
      tipo?: string;
      resultado?: string;
    },
  ): SelectQueryBuilder<AuditLog> {
    if (filters?.institutionId != null) {
      qb.andWhere('log.institutionId = :institutionId', {
        institutionId: filters.institutionId,
      });
    }
    if (filters?.tipo === 'accesos') {
      qb.andWhere('log.accion IN (:...accessActions)', {
        accessActions: ['login', 'logout'],
      });
    }
    if (filters?.modulo) {
      qb.andWhere('log.modulo = :modulo', { modulo: filters.modulo });
    }
    if (filters?.accion) {
      qb.andWhere('log.accion = :accion', { accion: filters.accion });
    }
    if (filters?.nivel) {
      qb.andWhere('log.nivel = :nivel', { nivel: filters.nivel });
    }
    if (filters?.resultado) {
      qb.andWhere('log.resultado = :resultado', { resultado: filters.resultado });
    }
    if (filters?.usuario?.trim()) {
      qb.andWhere(
        '(log.usuarioNombre ILIKE :usuario OR log.usuarioRol ILIKE :usuario)',
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
        '(log.descripcion ILIKE :q OR log.entidad ILIKE :q OR log.entidadId ILIKE :q OR log.modulo ILIKE :q OR log."correlationId" ILIKE :q)',
        { q },
      );
    }
    return qb;
  }

  private async buildResumenSql(
    qb: SelectQueryBuilder<AuditLog>,
  ): Promise<AuditLogResumen> {
    const base = qb.clone();
    const hoy = new Date().toISOString().slice(0, 10);

    const totals = await base
      .clone()
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN DATE(log."createdAt") = :hoy THEN 1 ELSE 0 END)`,
        'hoy',
      )
      .addSelect(
        `SUM(CASE WHEN log.nivel = 'critical' THEN 1 ELSE 0 END)`,
        'criticos',
      )
      .addSelect(
        `SUM(CASE WHEN log.nivel = 'warning' THEN 1 ELSE 0 END)`,
        'advertencias',
      )
      .addSelect(
        `SUM(CASE WHEN log.accion IN ('login','logout') THEN 1 ELSE 0 END)`,
        'accesos',
      )
      .addSelect(
        `SUM(CASE WHEN log.accion IN ('login','logout') AND log.resultado = 'error' THEN 1 ELSE 0 END)`,
        'accesosFallidos',
      )
      .setParameter('hoy', hoy)
      .getRawOne<{
        total: string;
        hoy: string;
        criticos: string;
        advertencias: string;
        accesos: string;
        accesosFallidos: string;
      }>();

    const porModuloRows = await base
      .clone()
      .select('log.modulo', 'modulo')
      .addSelect('COUNT(*)', 'total')
      .groupBy('log.modulo')
      .orderBy('total', 'DESC')
      .limit(6)
      .getRawMany<{ modulo: string; total: string }>();

    return {
      total: Number(totals?.total ?? 0),
      hoy: Number(totals?.hoy ?? 0),
      criticos: Number(totals?.criticos ?? 0),
      advertencias: Number(totals?.advertencias ?? 0),
      accesos: Number(totals?.accesos ?? 0),
      accesosFallidos: Number(totals?.accesosFallidos ?? 0),
      porModulo: porModuloRows.map((row) => ({
        modulo: row.modulo,
        total: Number(row.total),
      })),
    };
  }

  private buildResumen(rows: AuditLog[]): AuditLogResumen {
    const hoy = new Date().toISOString().slice(0, 10);
    const porModuloMap = new Map<string, number>();

    for (const row of rows) {
      porModuloMap.set(row.modulo, (porModuloMap.get(row.modulo) ?? 0) + 1);
    }

    const accesos = rows.filter((r) => r.accion === 'login' || r.accion === 'logout');
    const accesosFallidos = accesos.filter((r) => r.resultado === 'error');

    return {
      total: rows.length,
      hoy: rows.filter((r) => r.createdAt.toISOString().startsWith(hoy)).length,
      criticos: rows.filter((r) => r.nivel === 'critical').length,
      advertencias: rows.filter((r) => r.nivel === 'warning').length,
      accesos: accesos.length,
      accesosFallidos: accesosFallidos.length,
      porModulo: [...porModuloMap.entries()]
        .map(([modulo, total]) => ({ modulo, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
    };
  }

  private toResponse(log: AuditLog): AuditLogResponse {
    const fecha = log.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fechaDisplay = `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
    const horaDisplay = `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;

    return {
      id: log.id,
      usuarioId: log.usuarioId,
      usuarioNombre: log.usuarioNombre,
      usuarioRol: log.usuarioRol,
      accion: log.accion,
      modulo: log.modulo,
      entidad: log.entidad,
      entidadId: log.entidadId,
      descripcion: log.descripcion,
      detalle: log.detalle,
      ip: log.ip,
      nivel: log.nivel,
      resultado: log.resultado ?? 'success',
      correlationId: log.correlationId,
      createdAt: log.createdAt.toISOString(),
      fechaDisplay,
      horaDisplay,
    };
  }
}

function csvCell(value: string): string {
  const v = value.replace(/"/g, '""');
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
}
