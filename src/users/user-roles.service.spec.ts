import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRolesService } from './user-roles.service';
import { UserRoleAssignment } from './entities/user-role-assignment.entity';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { RolesService } from '../roles/roles.service';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { AuthCacheService } from '../auth/auth-cache.service';

describe('UserRolesService', () => {
  let service: UserRolesService;

  const assignmentRepo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
    manager: {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: () => ({
            save: jest.fn(),
            create: jest.fn((v) => v),
          }),
          query: jest.fn(),
        }),
      ),
    },
  };

  const roleRepoMock = {
    find: jest.fn().mockImplementation(({ where }) => {
      const raw = where?.codigo;
      const codes: string[] = raw?._value ?? raw ?? [];
      return Promise.resolve(
        (Array.isArray(codes) ? codes : [codes]).map((codigo) => ({ codigo, label: codigo })),
      );
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: getRepositoryToken(UserRoleAssignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn(), manager: { query: jest.fn() } } },
        { provide: getRepositoryToken(Role), useValue: roleRepoMock },
        {
          provide: RolesService,
          useValue: {
            getPermissionsByRoleCodigo: jest.fn().mockResolvedValue(['dashboard.ver']),
            isAdminRole: jest.fn().mockResolvedValue(false),
          },
        },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
        { provide: AuthCacheService, useValue: { invalidate: jest.fn() } },
      ],
    }).compile();

    service = module.get(UserRolesService);
  });

  it('rechaza asignaciones sin rol principal', async () => {
    await expect(
      service.validateAssignments([
        { roleCodigo: 'DOCENTE', ambito: 'IE', esPrincipal: false },
        { roleCodigo: 'DIRECTOR', ambito: 'IE', esPrincipal: false },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza ámbito UGEL sin ugelCodigo', async () => {
    await expect(
      service.validateAssignments([
        { roleCodigo: 'UGEL', ambito: 'UGEL', esPrincipal: true },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('resuelve permisos unión de múltiples roles', async () => {
    assignmentRepo.find.mockResolvedValue([
      {
        roleCodigo: 'DOCENTE',
        ambito: 'IE',
        esPrincipal: true,
        activo: true,
        motivo: 'test',
        createdAt: new Date('2026-01-01'),
      },
      {
        roleCodigo: 'DIRECTOR',
        ambito: 'IE',
        esPrincipal: false,
        activo: true,
        motivo: 'test',
        createdAt: new Date('2026-01-01'),
      },
    ]);

    const rolesService = {
      getPermissionsByRoleCodigo: jest
        .fn()
        .mockResolvedValueOnce(['evaluacion.ver'])
        .mockResolvedValueOnce(['matricula.ver']),
      isAdminRole: jest.fn().mockResolvedValue(false),
    };

    const module = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: getRepositoryToken(UserRoleAssignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn(), manager: { query: jest.fn() } } },
        { provide: getRepositoryToken(Role), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: RolesService, useValue: rolesService },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
        { provide: AuthCacheService, useValue: { invalidate: jest.fn() } },
      ],
    }).compile();

    const svc = module.get(UserRolesService);
    const effective = await svc.resolveEffectiveAuth(1);
    expect(effective.roleCodigos).toEqual(['DOCENTE', 'DIRECTOR']);
    expect(effective.permisos).toEqual(
      expect.arrayContaining(['evaluacion.ver', 'matricula.ver']),
    );
  });
});
