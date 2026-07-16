import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuditLogDto } from './dto/audit-log.dto';
import {
  AuditAccion,
  AuditLog,
  AuditNivel,
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
  createdAt: string;
  fechaDisplay: string;
  horaDisplay: string;
}

export interface AuditLogResumen {
  total: number;
  hoy: number;
  criticos: number;
  advertencias: number;
  porModulo: { modulo: string; total: number }[];
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLogResponse> {
    const saved = await this.auditRepo.save(
      this.auditRepo.create({
        usuarioId: dto.usuarioId ?? null,
        usuarioNombre: dto.usuarioNombre?.trim() ?? 'Sistema',
        usuarioRol: dto.usuarioRol?.trim() ?? '',
        accion: dto.accion as AuditAccion,
        modulo: dto.modulo.trim(),
        entidad: dto.entidad.trim(),
        entidadId: dto.entidadId ?? null,
        descripcion: dto.descripcion.trim(),
        detalle: dto.detalle ?? null,
        ip: dto.ip?.trim() ?? '',
        nivel: (dto.nivel as AuditNivel) ?? 'info',
      }),
    );
    return this.toResponse(saved);
  }

  async findAll(filters?: {
    modulo?: string;
    accion?: string;
    nivel?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
  }): Promise<{ resumen: AuditLogResumen; items: AuditLogResponse[] }> {
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filters?.modulo) {
      qb.andWhere('log.modulo = :modulo', { modulo: filters.modulo });
    }
    if (filters?.accion) {
      qb.andWhere('log.accion = :accion', { accion: filters.accion });
    }
    if (filters?.nivel) {
      qb.andWhere('log.nivel = :nivel', { nivel: filters.nivel });
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
        '(log.descripcion ILIKE :q OR log.entidad ILIKE :q OR log.entidadId ILIKE :q OR log.modulo ILIKE :q)',
        { q },
      );
    }

    const rows = await qb.getMany();
    const items = rows.map((row) => this.toResponse(row));
    const resumen = this.buildResumen(rows);

    return { resumen, items };
  }

  async findOne(id: number): Promise<AuditLogResponse> {
    const log = await this.auditRepo.findOneBy({ id });
    if (!log) throw new NotFoundException(`Registro de bitácora ${id} no encontrado`);
    return this.toResponse(log);
  }

  private buildResumen(rows: AuditLog[]): AuditLogResumen {
    const hoy = new Date().toISOString().slice(0, 10);
    const porModuloMap = new Map<string, number>();

    for (const row of rows) {
      porModuloMap.set(row.modulo, (porModuloMap.get(row.modulo) ?? 0) + 1);
    }

    return {
      total: rows.length,
      hoy: rows.filter((r) => r.createdAt.toISOString().startsWith(hoy)).length,
      criticos: rows.filter((r) => r.nivel === 'critical').length,
      advertencias: rows.filter((r) => r.nivel === 'warning').length,
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
      createdAt: log.createdAt.toISOString(),
      fechaDisplay,
      horaDisplay,
    };
  }
}
