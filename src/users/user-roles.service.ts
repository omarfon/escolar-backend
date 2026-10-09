import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { AuthCacheService } from '../auth/auth-cache.service';
import { Role } from '../roles/entities/role.entity';
import { esAdminNacional } from '../roles/roles-rbac-visibility.util';
import { RolesService } from '../roles/roles.service';
import {
  RoleAssignmentItemDto,
  SetUserRoleAssignmentsDto,
  UserRoleAssignmentResponse,
} from './dto/user-role-assignment.dto';
import {
  AmbitoTerritorial,
  UserRoleAssignment,
} from './entities/user-role-assignment.entity';
import { User, UserRole } from './entities/user.entity';

export interface EffectiveUserAuth {
  roleCodigos: UserRole[];
  permisos: string[];
  esAdmin: boolean;
  primaryRole: UserRole;
  assignments: UserRoleAssignmentResponse[];
  ambitos: AmbitoTerritorial[];
  institutionId: number | null;
}

@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentRepo: Repository<UserRoleAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly rolesService: RolesService,
    private readonly auditLogger: AuditLoggerService,
    private readonly authCache: AuthCacheService,
  ) {}

  async getActiveAssignments(userId: number): Promise<UserRoleAssignment[]> {
    return this.assignmentRepo.find({
      where: { userId, activo: true },
      order: { esPrincipal: 'DESC', createdAt: 'ASC' },
    });
  }

  async listAssignments(userId: number): Promise<UserRoleAssignmentResponse[]> {
    await this.ensureUserExists(userId);
    const rows = await this.assignmentRepo.find({
      where: { userId },
      order: { activo: 'DESC', esPrincipal: 'DESC', createdAt: 'ASC' },
    });
    return this.mapAssignments(rows);
  }

  async resolveEffectiveAuth(userId: number): Promise<EffectiveUserAuth> {
    const assignments = await this.getActiveAssignments(userId);
    if (!assignments.length) {
      const user = await this.userRepo.findOneBy({ id: userId });
      const fallback = (user?.rol ?? 'DOCENTE') as UserRole;
      const permisos = await this.rolesService.getPermissionsByRoleCodigo(fallback);
      const esAdmin = await this.rolesService.isAdminRole(fallback);
      return {
        roleCodigos: [fallback],
        permisos,
        esAdmin,
        primaryRole: fallback,
        assignments: [],
        ambitos: ['IE'],
        institutionId: await this.defaultInstitutionId(),
      };
    }

    const roleCodigos = [...new Set(assignments.map((a) => a.roleCodigo))] as UserRole[];
    const permisosSet = new Set<string>();
    let esAdmin = false;

    for (const codigo of roleCodigos) {
      const perms = await this.rolesService.getPermissionsByRoleCodigo(codigo);
      perms.forEach((p) => permisosSet.add(p));
      if (await this.rolesService.isAdminRole(codigo)) {
        esAdmin = true;
      }
    }

    const primary =
      assignments.find((a) => a.esPrincipal)?.roleCodigo ??
      assignments[0].roleCodigo;

    return {
      roleCodigos,
      permisos: [...permisosSet],
      esAdmin,
      primaryRole: primary as UserRole,
      assignments: await this.mapAssignments(assignments),
      ambitos: [...new Set(assignments.map((a) => a.ambito))],
      institutionId: institutionIdDeAsignaciones(assignments),
    };
  }

  async setAssignments(
    userId: number,
    dto: SetUserRoleAssignmentsDto,
    actor?: { id: number; nombre: string; rol: string },
    alcance?: { siagie: boolean; institutionId?: number; adminNacional?: boolean },
  ): Promise<UserRoleAssignmentResponse[]> {
    await this.ensureUserExists(userId);
    await this.validateAssignments(dto.assignments, alcance);

    const before = await this.getActiveAssignments(userId);
    const institutionId = await this.defaultInstitutionId();
    const rolesCatalogo = await this.roleRepo.find({
      where: { codigo: In(dto.assignments.map((item) => item.roleCodigo) as never[]) },
    });
    const rolPorCodigo = new Map(rolesCatalogo.map((role) => [role.codigo, role]));

    await this.assignmentRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(UserRoleAssignment);
      const userRepository = manager.getRepository(User);

      const now = new Date();
      for (const row of before) {
        row.activo = false;
        row.revokedAt = now;
        await repo.save(row);
      }

      for (const item of dto.assignments) {
        const rol = rolPorCodigo.get(item.roleCodigo);
        const institutionIdAsignado =
          item.ambito !== 'IE'
            ? null
            : alcance && !alcance.siagie
              ? alcance.institutionId ?? institutionId
              : rol?.institutionId ?? item.institutionId ?? institutionId;
        const entity = repo.create({
          userId,
          roleCodigo: item.roleCodigo,
          ambito: item.ambito,
          dreCodigo: item.dreCodigo?.trim() || null,
          ugelCodigo: item.ugelCodigo?.trim() || null,
          institutionId: institutionIdAsignado,
          esPrincipal: item.esPrincipal,
          activo: true,
          motivo: dto.motivo.trim(),
          createdByUserId: actor?.id ?? null,
          revokedAt: null,
        });
        await repo.save(entity);
      }

      const primary =
        dto.assignments.find((a) => a.esPrincipal)?.roleCodigo ??
        dto.assignments[0].roleCodigo;

      await userRepository.update(userId, {
        rol: primary as UserRole,
        sessionVersion: () => '"sessionVersion" + 1',
      });
    });

    const after = await this.getActiveAssignments(userId);

    this.auditLogger.log({
      accion: 'configurar',
      modulo: 'administracion',
      entidad: 'user_role_assignment',
      entidadId: String(userId),
      descripcion: 'Asignación multi-rol de usuario actualizada',
      usuarioId: actor?.id ?? null,
      usuarioNombre: actor?.nombre ?? 'Sistema',
      usuarioRol: actor?.rol ?? '',
      detalle: {
        motivo: dto.motivo,
        antes: before.map((b) => this.snapshotAssignment(b)),
        despues: after.map((a) => this.snapshotAssignment(a)),
      },
    });

    this.authCache.invalidate(userId);
    return this.mapAssignments(after);
  }

  async ensureLegacyAssignment(userId: number, roleCodigo: string): Promise<void> {
    const existing = await this.getActiveAssignments(userId);
    if (existing.length) return;

    const institutionId = await this.defaultInstitutionId();
    await this.assignmentRepo.save(
      this.assignmentRepo.create({
        userId,
        roleCodigo,
        ambito: 'IE',
        institutionId,
        esPrincipal: true,
        activo: true,
        motivo: 'Asignación inicial al crear usuario',
      }),
    );
  }

  async validateAssignments(
    assignments: RoleAssignmentItemDto[],
    alcance?: { siagie: boolean; institutionId?: number; adminNacional?: boolean },
  ): Promise<void> {
    if (!assignments.length) {
      throw new BadRequestException('Debe asignar al menos un rol');
    }

    const principals = assignments.filter((a) => a.esPrincipal);
    if (principals.length !== 1) {
      throw new BadRequestException(
        'Debe indicar exactamente un rol principal (esPrincipal)',
      );
    }

    const roleCodes = [...new Set(assignments.map((a) => a.roleCodigo))];
    const existingRoles = await this.roleRepo.find({
      where: { codigo: In(roleCodes as never[]) },
    });
    const validCodes = new Set(existingRoles.map((r) => r.codigo));
    for (const code of roleCodes) {
      if (!validCodes.has(code)) {
        throw new BadRequestException(`Rol "${code}" no existe en el catálogo`);
      }
    }

    if (alcance && !alcance.siagie) {
      if (!alcance.institutionId || alcance.institutionId < 1) {
        throw new ForbiddenException('Su usuario no tiene una institución asignada.');
      }
      for (const role of existingRoles) {
        if (role.codigo === 'SIAGIE') {
          throw new ForbiddenException('No puede asignar el rol SIAGIE.');
        }
        if (
          !alcance.adminNacional &&
          (role.codigo === 'UGEL' || role.codigo === 'DRE' || role.codigo === 'MINEDU')
        ) {
          throw new ForbiddenException(`No puede asignar el rol ${role.label}.`);
        }
        if (role.institutionId != null && role.institutionId !== alcance.institutionId) {
          throw new ForbiddenException(`El rol ${role.label} pertenece a otra sede.`);
        }
      }
    }

    const keys = new Set<string>();
    for (const item of assignments) {
      if (item.ambito === 'DRE' && !item.dreCodigo?.trim()) {
        throw new BadRequestException(
          `Rol ${item.roleCodigo}: ámbito DRE requiere dreCodigo`,
        );
      }
      if (item.ambito === 'UGEL' && !item.ugelCodigo?.trim()) {
        throw new BadRequestException(
          `Rol ${item.roleCodigo}: ámbito UGEL requiere ugelCodigo`,
        );
      }

      const key = [
        item.roleCodigo,
        item.ambito,
        item.dreCodigo ?? '',
        item.ugelCodigo ?? '',
        item.institutionId ?? 0,
      ].join('|');

      if (keys.has(key)) {
        throw new BadRequestException(
          'Hay asignaciones duplicadas (mismo rol y ámbito)',
        );
      }
      keys.add(key);
    }
  }

  private async mapAssignments(
    rows: UserRoleAssignment[],
  ): Promise<UserRoleAssignmentResponse[]> {
    const roleLabels = new Map<string, string>();
    const roles = await this.roleRepo.find();
    roles.forEach((r) => roleLabels.set(r.codigo, r.label));

    return rows.map((row) => ({
      id: row.id,
      roleCodigo: row.roleCodigo,
      roleLabel: roleLabels.get(row.roleCodigo) ?? row.roleCodigo,
      ambito: row.ambito,
      dreCodigo: row.dreCodigo,
      ugelCodigo: row.ugelCodigo,
      institutionId: row.institutionId,
      esPrincipal: row.esPrincipal,
      activo: row.activo,
      motivo: row.motivo,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
  }

  private snapshotAssignment(row: UserRoleAssignment) {
    return {
      id: row.id,
      roleCodigo: row.roleCodigo,
      ambito: row.ambito,
      dreCodigo: row.dreCodigo,
      ugelCodigo: row.ugelCodigo,
      institutionId: row.institutionId,
      esPrincipal: row.esPrincipal,
    };
  }

  private async ensureUserExists(userId: number): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    return user;
  }

  private async defaultInstitutionId(): Promise<number | null> {
    const row = await this.userRepo.manager.query<{ id: number }[]>(
      `SELECT id FROM institutions ORDER BY id ASC LIMIT 1`,
    );
    return row[0]?.id ?? null;
  }
}

function institutionIdDeAsignaciones(
  assignments: UserRoleAssignment[],
): number | null {
  const ie =
    assignments.find((a) => a.ambito === 'IE' && a.esPrincipal && a.institutionId) ??
    assignments.find((a) => a.ambito === 'IE' && a.institutionId) ??
    assignments.find((a) => a.institutionId);
  return ie?.institutionId ?? null;
}
