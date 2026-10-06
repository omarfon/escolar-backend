import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthCacheService } from '../auth/auth-cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BulkUserRowDto } from './dto/bulk-import-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRoleAssignmentResponse } from './dto/user-role-assignment.dto';
import { User } from './entities/user.entity';
import { UserRolesService } from './user-roles.service';

export interface UserResponse {
  id: number;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  username: string;
  telefono: string;
  rol: string;
  roles: string[];
  roleAssignments: UserRoleAssignmentResponse[];
  sede: string;
  estado: string;
  cargo: string;
  ultimoAcceso: string | null;
}

export interface BulkImportError {
  fila: number;
  email: string;
  dni: string;
  mensaje: string;
}

export interface BulkImportResult {
  total: number;
  creados: number;
  errores: BulkImportError[];
  usuarios: UserResponse[];
}

export const USER_IMPORT_TEMPLATE_HEADERS = [
  'nombres',
  'apellidos',
  'dni',
  'email',
  'telefono',
  'rol',
  'sede',
  'estado',
  'cargo',
  'password',
] as const;

export const USER_IMPORT_TEMPLATE_CSV = [
  USER_IMPORT_TEMPLATE_HEADERS.join(','),
  'Juan,Perez Torres,12345678,juan.perez@colegio.edu.pe,987654321,DOCENTE,Sede Central,activo,Docente de Matematicas,Clave1234',
  'Maria,Garcia Lopez,87654321,maria.garcia@colegio.edu.pe,987123456,SECRETARIA,Sede Central,activo,Secretaria Academica,Clave1234',
].join('\n');
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly userRolesService: UserRolesService,
    private readonly authCache: AuthCacheService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponse> {
    const username = dto.username?.trim() || dto.email.split('@')[0];
    const entity = this.usersRepo.create({
      ...dto,
      username,
      telefono: dto.telefono ?? '',
      sede: dto.sede ?? 'Sede Central',
      estado: dto.estado ?? 'activo',
      cargo: dto.cargo ?? '',
      ultimoAcceso: null,
    });
    const saved = await this.usersRepo.save(entity);

    if (dto.roleAssignments?.length) {
      await this.userRolesService.setAssignments(saved.id, {
        motivo: dto.roleAssignmentsMotivo ?? 'Asignación al crear usuario',
        assignments: dto.roleAssignments,
      });
    } else {
      await this.userRolesService.ensureLegacyAssignment(saved.id, saved.rol);
    }

    return this.toResponse(saved);
  }

  async bulkCreate(usuarios: BulkUserRowDto[]): Promise<BulkImportResult> {
    const creados: UserResponse[] = [];
    const errores: BulkImportError[] = [];

    for (let i = 0; i < usuarios.length; i++) {
      const row = usuarios[i];
      const fila = i + 2;
      try {
        const saved = await this.create({
          ...row,
          telefono: row.telefono ?? '',
          sede: row.sede ?? 'Sede Central',
          estado: row.estado ?? 'activo',
          cargo: row.cargo ?? '',
        });
        creados.push(saved);
      } catch (err: unknown) {
        const mensaje = this.extractBulkError(err);
        errores.push({
          fila,
          email: row.email,
          dni: row.dni,
          mensaje,
        });
      }
    }

    return {
      total: usuarios.length,
      creados: creados.length,
      errores,
      usuarios: creados,
    };
  }

  getImportTemplate(): string {
    return USER_IMPORT_TEMPLATE_CSV;
  }
  async findAll(): Promise<UserResponse[]> {
    const users = await this.usersRepo.find({
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });
    return Promise.all(users.map((u) => this.toResponse(u)));
  }

  async findOne(id: number): Promise<UserResponse> {
    const user = await this.getOrFail(id);
    return this.toResponse(user);
  }

  async findByLogin(username: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :login OR user.email = :login', { login: username })
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findAuthUserById(id: number): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async getSessionVersion(id: number): Promise<number> {
    const row = await this.usersRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.sessionVersion'])
      .where('user.id = :id', { id })
      .getOne();
    return row?.sessionVersion ?? 0;
  }

  async updatePasswordAndInvalidateSessions(
    id: number,
    hashedPassword: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.usersRepo;
    await repo
      .createQueryBuilder()
      .update(User)
      .set({
        password: hashedPassword,
        sessionVersion: () => '"sessionVersion" + 1',
      })
      .where('id = :id', { id })
      .execute();
    this.authCache.invalidate(id);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponse> {
    const current = await this.getOrFail(id);
    const { password, username, ...rest } = dto;
    Object.assign(current, rest);
    if (username !== undefined) current.username = username.trim();
    if (password) current.password = password;
    const saved = await this.usersRepo.save(current);
    return this.toResponse(saved);
  }

  async toggleEstado(id: number): Promise<UserResponse> {
    const current = await this.getOrFail(id);
    current.estado = current.estado === 'activo' ? 'inactivo' : 'activo';
    const saved = await this.usersRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.usersRepo.remove(current);
    return { deleted: true, id };
  }

  async touchUltimoAcceso(id: number) {
    await this.usersRepo.update(id, { ultimoAcceso: new Date() });
  }

  private async getOrFail(id: number): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  private async toResponse(user: User): Promise<UserResponse> {
    const effective = await this.userRolesService.resolveEffectiveAuth(user.id);
    return {
      id: user.id,
      nombres: user.nombres,
      apellidos: user.apellidos,
      dni: user.dni,
      email: user.email,
      username: user.username,
      telefono: user.telefono,
      rol: effective.primaryRole,
      roles: effective.roleCodigos,
      roleAssignments: effective.assignments,
      sede: user.sede,
      estado: user.estado,
      cargo: user.cargo,
      ultimoAcceso: user.ultimoAcceso ? this.formatFecha(user.ultimoAcceso) : null,
    };
  }

  private formatFecha(date: Date): string {
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private extractBulkError(err: unknown): string {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = String((err as { code: string }).code);
      if (code === '23505') return 'DNI o email ya registrado en el sistema';
    }
    if (err && typeof err === 'object' && 'message' in err) {
      const message = String((err as { message: string }).message);
      if (message.includes('duplicate') || message.includes('unique')) {
        return 'DNI o email ya registrado en el sistema';
      }
    }
    return 'No se pudo registrar el usuario';
  }
}