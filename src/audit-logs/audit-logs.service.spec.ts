import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from './entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  const mockCloneQb = {
    clone: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({
      total: '0',
      hoy: '0',
      criticos: '0',
      advertencias: '0',
      accesos: '0',
      accesosFallidos: '0',
    }),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  const mockQb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(() => mockCloneQb),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const auditRepo = {
    save: jest.fn(async (v) => ({ id: 1, createdAt: new Date(), ...v })),
    create: jest.fn((v) => v),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
  };

  const institutionRepo = {
    findOne: jest.fn().mockResolvedValue({
      nombre: 'IE Demo',
      siglas: 'IED',
      anio: 2026,
      ugel: 'UGEL 01',
      dre: 'DRE LM',
    }),
    save: jest.fn(),
    create: jest.fn((v) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getRepositoryToken(Institution), useValue: institutionRepo },
      ],
    }).compile();

    service = module.get(AuditLogsService);
  });

  it('bloquea creación manual vía API', () => {
    expect(() => service.assertAppendOnlyApi()).toThrow(ForbiddenException);
  });

  it('expone contexto institucional y retención', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.nombre).toBe('IE Demo');
    expect(ctx.retencionDias).toBeGreaterThan(0);
    expect(ctx.permisoConsulta).toBe('admin.reportes');
  });

  it('filtra accesos con tipo=accesos', async () => {
    await service.findAll({ tipo: 'accesos', page: 1, pageSize: 20 });
    expect(mockQb.andWhere).toHaveBeenCalledWith(
      'log.accion IN (:...accessActions)',
      { accessActions: ['login', 'logout'] },
    );
  });

  it('persiste correlationId en create interno', async () => {
    await service.create({
      accion: 'login',
      modulo: 'autenticacion',
      entidad: 'sesion',
      descripcion: 'Test',
      correlationId: 'persist-123',
    });
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'persist-123' }),
    );
  });

  it('pagina resultados', async () => {
    mockQb.getManyAndCount.mockResolvedValueOnce([
      [
        {
          id: 5,
          usuarioNombre: 'Ana',
          usuarioRol: 'ADMIN',
          accion: 'login',
          modulo: 'autenticacion',
          entidad: 'sesion',
          entidadId: null,
          descripcion: 'Inicio de sesión exitoso',
          detalle: null,
          ip: '127.0.0.1',
          nivel: 'info',
          resultado: 'success',
          correlationId: 'abc-123',
          createdAt: new Date('2026-01-15T10:00:00'),
        },
      ],
      1,
    ]);

    const res = await service.findAll({ page: 1, pageSize: 50 });
    expect(res.pagination.totalItems).toBe(1);
    expect(res.items[0].resultado).toBe('success');
    expect(res.items[0].correlationId).toBe('abc-123');
  });
});
