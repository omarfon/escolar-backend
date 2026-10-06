import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AUDIT_LOG_RETENTION_DAYS } from '../audit-logs/audit-logs.constants';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PERMISSION_SECTIONS, ROLE_DEFINITIONS } from '../roles/roles.constants';
import { UserRolesService } from '../users/user-roles.service';

export interface RbacContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
  permisoGestionRoles: string;
  permisoGestionUsuarios: string;
  ambitos: Array<{ codigo: string; label: string }>;
  rolesTerritoriales: string[];
  reglaResolucion: string;
}

export interface RbacAuditItem {
  id: number;
  fechaDisplay: string;
  horaDisplay: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  actorNombre: string;
  actorRol: string;
  descripcion: string;
  detalle: Record<string, unknown> | null;
  resultado: string;
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly userRolesService: UserRolesService,
  ) {}

  async getContext(): Promise<RbacContext> {
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
      permisoConsulta: 'admin.roles',
      permisoGestionRoles: 'admin.roles',
      permisoGestionUsuarios: 'admin.usuarios',
      ambitos: [
        { codigo: 'IE', label: 'Institución Educativa' },
        { codigo: 'UGEL', label: 'UGEL' },
        { codigo: 'DRE', label: 'DRE' },
        { codigo: 'MINEDU', label: 'MINEDU' },
      ],
      rolesTerritoriales: ROLE_DEFINITIONS.filter((r) =>
        ['UGEL', 'DRE', 'MINEDU'].includes(r.codigo),
      ).map((r) => r.codigo),
      reglaResolucion:
        'Permisos efectivos = unión de todos los roles activos; el rol principal define la vista por defecto.',
    };
  }

  async getEffectiveAuth(userId: number) {
    const effective = await this.userRolesService.resolveEffectiveAuth(userId);
    return {
      userId,
      ...effective,
      permisosCount: effective.permisos.length,
      catalogSections: PERMISSION_SECTIONS.length,
    };
  }

  async findAudit(filters?: {
    entidad?: string;
    usuario?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: RbacAuditItem[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));

    const qb = this.auditRepo
      .createQueryBuilder('log')
      .where('log.modulo = :modulo', { modulo: 'administracion' })
      .andWhere('log.entidad IN (:...entidades)', {
        entidades: ['user_role_assignment', 'role_permission'],
      });

    this.applyAuditFilters(qb, filters);

    const [rows, totalItems] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.toAuditItem(row)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }

  private applyAuditFilters(
    qb: SelectQueryBuilder<AuditLog>,
    filters?: {
      entidad?: string;
      usuario?: string;
      desde?: string;
      hasta?: string;
    },
  ): void {
    if (filters?.entidad) {
      qb.andWhere('log.entidad = :entidad', { entidad: filters.entidad });
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
  }

  private toAuditItem(row: AuditLog): RbacAuditItem {
    const fecha = row.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: row.id,
      fechaDisplay: `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`,
      horaDisplay: `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`,
      accion: row.accion,
      entidad: row.entidad,
      entidadId: row.entidadId,
      actorNombre: row.usuarioNombre,
      actorRol: row.usuarioRol,
      descripcion: row.descripcion,
      detalle: row.detalle,
      resultado: row.resultado,
    };
  }
}
