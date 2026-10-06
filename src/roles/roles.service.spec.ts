import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { UserRoleAssignment } from '../users/entities/user-role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  const auditLogger = { log: jest.fn() };

  const roleRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    manager: { query: jest.fn().mockResolvedValue([]) },
  };
  const permissionRepo = {
    find: jest.fn(),
  };
  const rolePermissionRepo = {
    delete: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(),
    find: jest.fn(),
  };
  const userRepo = {
    count: jest.fn(),
    manager: { query: jest.fn() },
  };
  const assignmentRepo = {
    count: jest.fn().mockResolvedValue(2),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(Permission), useValue: permissionRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserRoleAssignment), useValue: assignmentRepo },
        { provide: AuditLoggerService, useValue: auditLogger },
      ],
    }).compile();
    service = module.get(RolesService);
  });

  it('audita y revoca sesiones al actualizar permisos', async () => {
    roleRepo.findOne.mockResolvedValue({
      id: 1,
      codigo: 'DOCENTE',
      label: 'Docente',
      descripcion: '',
      color: 'bg-teal-500',
      esAdmin: false,
    });
    rolePermissionRepo.find.mockResolvedValue([
      { permission: { codigo: 'evaluacion.ver' } },
    ]);
    permissionRepo.find.mockResolvedValue([
      { id: 10, codigo: 'evaluacion.ver' },
      { id: 11, codigo: 'evaluacion.registrar' },
    ]);

    await service.updatePermissions(
      'DOCENTE',
      ['evaluacion.ver', 'evaluacion.registrar'],
      { id: 1, nombre: 'Admin', rol: 'ADMIN' },
      'Prueba unitaria',
    );

    expect(rolePermissionRepo.delete).toHaveBeenCalled();
    expect(userRepo.manager.query).toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'role_permission',
        entidadId: 'DOCENTE',
      }),
    );
  });
});
