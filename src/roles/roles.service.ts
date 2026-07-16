import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { PERMISSION_SECTIONS } from './roles.constants';

export interface RoleResponse {
  codigo: string;
  label: string;
  descripcion: string;
  color: string;
  esAdmin: boolean;
  usuariosCount: number;
  permisos: string[];
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
  ) {}

  async findAll(): Promise<{ roles: RoleResponse[]; catalog: typeof PERMISSION_SECTIONS }> {
    const roles = await this.roleRepo.find({ order: { orden: 'ASC' } });
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

    const userCounts = await this.userRepo
      .createQueryBuilder('u')
      .select('u.rol', 'rol')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.rol')
      .getRawMany<{ rol: string; count: string }>();

    const countMap = new Map(userCounts.map((r) => [r.rol, Number(r.count)]));

    return {
      roles: roles.map((role) => ({
        codigo: role.codigo,
        label: role.label,
        descripcion: role.descripcion,
        color: role.color,
        esAdmin: role.esAdmin,
        usuariosCount: countMap.get(role.codigo) ?? 0,
        permisos: permisosByRole.get(role.codigo) ?? [],
      })),
      catalog: PERMISSION_SECTIONS,
    };
  }

  async updatePermissions(codigo: string, permisos: string[]): Promise<RoleResponse> {
    const role = await this.roleRepo.findOne({ where: { codigo } });
    if (!role) {
      throw new NotFoundException(`Rol ${codigo} no encontrado`);
    }

    const permissions = await this.permissionRepo.find({
      where: { codigo: In(permisos) },
    });

    await this.rolePermissionRepo.delete({ roleId: role.id });

    if (permissions.length > 0) {
      const rows = permissions.map((p) =>
        this.rolePermissionRepo.create({ roleId: role.id, permissionId: p.id }),
      );
      await this.rolePermissionRepo.save(rows);
    }

    const userCount = await this.userRepo.count({ where: { rol: codigo as UserRole } });

    return {
      codigo: role.codigo,
      label: role.label,
      descripcion: role.descripcion,
      color: role.color,
      esAdmin: role.esAdmin,
      usuariosCount: userCount,
      permisos: permissions.map((p) => p.codigo),
    };
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
}
