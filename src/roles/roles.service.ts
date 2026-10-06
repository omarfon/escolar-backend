import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { UserRoleAssignment } from '../users/entities/user-role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { PERMISSION_SECTIONS } from './roles.constants';
import { esAdministradorDeSede } from './sede-admin-role';

export interface RoleScope {
  siagie: boolean;
  institutionId?: number;
}

export interface RoleResponse {
  codigo: string;
  label: string;
  descripcion: string;
  color: string;
  esAdmin: boolean;
  usuariosCount: number;
  permisos: string[];
  institutionId: number | null;
  institucionNombre: string | null;
  esSistema: boolean;
}

export interface RoleUpdateActor {
  id: number;
  nombre: string;
  rol: string;
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentRepo: Repository<UserRoleAssignment>,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async findAll(institutionId?: number): Promise<{ roles: RoleResponse[]; catalog: typeof PERMISSION_SECTIONS }> {
    const roles = await this.roleRepo.find({
      where: institutionId === undefined ? {} : { institutionId },
      order: { orden: 'ASC' },
    });
    const allRolePermissions = await this.rolePermissionRepo.find({
      relations: { permission: true, role: true },
    });

    const permisosByRole = new Map<string, string[]>();
    for (const rp of allRolePermissions) {
      const codigo = rp.role?.codigo;
      if (!codigo) continue;
      const list = permisosByRole.get(codigo) ?? [];
      list.push(rp.permission.codigo);
      permisosByRole.set(codigo, list);
    }

    const userCounts = await this.userRepo.manager.query<
      { roleCodigo: string; count: string }[]
    >(
      `SELECT "roleCodigo", COUNT(DISTINCT "userId")::text AS count
       FROM user_role_assignments
       WHERE activo = true
       GROUP BY "roleCodigo"`,
    );

    const countMap = new Map(
      userCounts.map((r) => [r.roleCodigo, Number(r.count)]),
    );
    const instituciones = await this.roleRepo.manager.query<{ id: number; nombre: string }[]>(
      `SELECT id, nombre FROM institutions`,
    );
    const nombrePorId = new Map(instituciones.map((row) => [Number(row.id), row.nombre]));

    return {
      roles: roles.map((role) => this.toResponse(role, permisosByRole.get(role.codigo) ?? [], countMap.get(role.codigo) ?? 0, nombrePorId)),
      catalog: PERMISSION_SECTIONS,
    };
  }

  async create(
    dto: { label: string; descripcion?: string; permisos?: string[]; basadoEn?: string; institutionId?: number },
    scope: RoleScope,
    actor?: RoleUpdateActor,
  ): Promise<RoleResponse> {
    const institutionId = scope.siagie ? dto.institutionId : scope.institutionId;
    if (!institutionId || institutionId < 1) {
      throw new BadRequestException('Indique la institución de la sede para crear el rol.');
    }
    if (!scope.siagie && scope.institutionId !== institutionId) {
      throw new ForbiddenException('Solo puede crear roles de su sede.');
    }

    const institucion = await this.roleRepo.manager.query<{ id: number; nombre: string }[]>(
      `SELECT id, nombre FROM institutions WHERE id = $1`,
      [institutionId],
    );
    if (!institucion[0]) throw new NotFoundException('Institución no encontrada');

    const label = dto.label.trim();
    if (!label) throw new BadRequestException('Indique el nombre del rol.');

    let permisos = [...new Set((dto.permisos ?? []).map((p) => p.trim()).filter(Boolean))];
    if (!permisos.length && dto.basadoEn?.trim()) {
      const base = await this.roleRepo.findOne({ where: { codigo: dto.basadoEn.trim() } });
      if (!base || (base.institutionId != null && base.institutionId !== institutionId) || base.codigo === 'SIAGIE') {
        throw new BadRequestException('La plantilla de rol no está disponible para esta sede.');
      }
      permisos = await this.getPermissionsByRoleCodigo(base.codigo);
    }
    if (!permisos.length) {
      throw new BadRequestException('Seleccione permisos o una plantilla para el rol.');
    }

    const permissions = await this.permissionRepo.find({ where: { codigo: In(permisos) } });
    const invalid = permisos.filter((p) => !permissions.some((row) => row.codigo === p));
    if (invalid.length) {
      throw new NotFoundException(`Permisos no válidos: ${invalid.join(', ')}`);
    }

    const codigo = await this.codigoDisponible(institutionId, label);
    const saved = await this.roleRepo.save(
      this.roleRepo.create({
        codigo,
        label: label.slice(0, 80),
        descripcion: (dto.descripcion?.trim() || `Rol de ${institucion[0].nombre}`).slice(0, 200),
        color: 'bg-teal-500',
        esAdmin: false,
        orden: 200 + institutionId,
        institutionId,
      }),
    );
    await this.rolePermissionRepo.save(
      permissions.map((p) => this.rolePermissionRepo.create({ roleId: saved.id, permissionId: p.id })),
    );

    this.auditLogger.log({
      accion: 'crear',
      modulo: 'administracion',
      entidad: 'role',
      entidadId: codigo,
      institutionId,
      descripcion: `Rol ${label} creado para ${institucion[0].nombre}`,
      usuarioId: actor?.id ?? null,
      usuarioNombre: actor?.nombre ?? 'Sistema',
      usuarioRol: actor?.rol ?? '',
      detalle: { institutionId, permisos },
    });

    return this.toResponse(saved, permissions.map((p) => p.codigo), 0, new Map([[institutionId, institucion[0].nombre]]));
  }

  async updatePermissions(
    codigo: string,
    permisos: string[],
    actor?: RoleUpdateActor,
    motivo?: string,
    scope?: RoleScope,
  ): Promise<RoleResponse> {
    const role = await this.roleRepo.findOne({ where: { codigo } });
    if (!role) {
      throw new NotFoundException(`Rol ${codigo} no encontrado`);
    }
    this.assertPuedeAdministrar(role, scope);

    const permisosAntes = await this.getPermissionsByRoleCodigo(codigo);

    const permissions = await this.permissionRepo.find({
      where: { codigo: In(permisos) },
    });

    const invalid = permisos.filter(
      (p) => !permissions.some((row) => row.codigo === p),
    );
    if (invalid.length) {
      throw new NotFoundException(
        `Permisos no válidos: ${invalid.join(', ')}`,
      );
    }

    await this.rolePermissionRepo.delete({ roleId: role.id });

    if (permissions.length > 0) {
      const rows = permissions.map((p) =>
        this.rolePermissionRepo.create({ roleId: role.id, permissionId: p.id }),
      );
      await this.rolePermissionRepo.save(rows);
    }

    await this.invalidateSessionsForRole(codigo);

    const permisosDespues = permissions.map((p) => p.codigo);

    this.auditLogger.log({
      accion: 'configurar',
      modulo: 'administracion',
      entidad: 'role_permission',
      entidadId: codigo,
      descripcion: `Permisos del rol ${codigo} actualizados`,
      usuarioId: actor?.id ?? null,
      usuarioNombre: actor?.nombre ?? 'Sistema',
      usuarioRol: actor?.rol ?? '',
      detalle: {
        motivo: motivo?.trim() || 'Actualización de permisos de rol',
        antes: permisosAntes,
        despues: permisosDespues,
        agregados: permisosDespues.filter((p) => !permisosAntes.includes(p)),
        removidos: permisosAntes.filter((p) => !permisosDespues.includes(p)),
      },
    });

    const userCount = await this.assignmentRepo.count({
      where: { roleCodigo: codigo, activo: true },
    });
    const instituciones = await this.roleRepo.manager.query<{ id: number; nombre: string }[]>(
      `SELECT id, nombre FROM institutions WHERE id = $1`,
      [role.institutionId ?? 0],
    );

    return this.toResponse(
      role,
      permisosDespues,
      userCount,
      new Map(instituciones.map((row) => [Number(row.id), row.nombre])),
    );
  }

  async getPermissionsByRoleCodigo(codigo: string): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { codigo } });
    if (!role) return [];

    const rows = await this.rolePermissionRepo.find({
      where: { roleId: role.id },
      relations: { permission: true },
    });

    return rows.map((r) => r.permission.codigo);
  }

  async isAdminRole(codigo: string): Promise<boolean> {
    const role = await this.roleRepo.findOne({ where: { codigo } });
    return role?.esAdmin ?? false;
  }

  private assertPuedeAdministrar(role: Role, scope?: RoleScope): void {
    if (!scope) return;
    if (scope.siagie) return;
    if (role.institutionId == null) {
      throw new ForbiddenException('Los roles generales los administra SIAGIE.');
    }
    if (role.institutionId !== scope.institutionId) {
      throw new ForbiddenException('Ese rol pertenece a otra sede.');
    }
    if (esAdministradorDeSede(role.codigo, role.institutionId)) {
      throw new ForbiddenException(
        'El administrador de sede conserva la configuración institucional y la gestión de roles. Cree los demás roles de la sede.',
      );
    }
  }

  private toResponse(
    role: Role,
    permisos: string[],
    usuariosCount: number,
    nombres: Map<number, string>,
  ): RoleResponse {
    return {
      codigo: role.codigo,
      label: role.label,
      descripcion: role.descripcion,
      color: role.color,
      esAdmin: role.esAdmin,
      usuariosCount,
      permisos,
      institutionId: role.institutionId ?? null,
      institucionNombre: role.institutionId ? nombres.get(role.institutionId) ?? null : null,
      esSistema: esAdministradorDeSede(role.codigo, role.institutionId),
    };
  }

  private async codigoDisponible(institutionId: number, label: string): Promise<string> {
    const slug = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10);
    const prefix = `S${institutionId}`;
    let n = 1;
    while (n < 100) {
      const suffix = n === 1 ? '' : String(n);
      const cuerpo = `${prefix}${slug || 'ROL'}`;
      const codigo = (cuerpo + suffix).slice(0, 20);
      const existe = await this.roleRepo.findOne({ where: { codigo } });
      if (!existe) return codigo;
      n += 1;
    }
    throw new BadRequestException('No se pudo generar un código para el rol.');
  }

  private async invalidateSessionsForRole(roleCodigo: string): Promise<void> {
    await this.userRepo.manager.query(
      `UPDATE users SET "sessionVersion" = "sessionVersion" + 1
       WHERE id IN (
         SELECT DISTINCT "userId" FROM user_role_assignments
         WHERE activo = true AND "roleCodigo" = $1
       )`,
      [roleCodigo],
    );
  }
}
