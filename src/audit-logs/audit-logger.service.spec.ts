import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AuditLoggerService } from './audit-logger.service';
import { AuditLogsService } from './audit-logs.service';
import { AuditWriteQueueService } from './audit-write-queue.service';

describe('AuditLoggerService', () => {
  let service: AuditLoggerService;
  const auditLogsService = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const auditQueue = {
    enqueue: jest.fn((dto: unknown) => {
      void auditLogsService.create(dto).catch(() => undefined);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: AuditWriteQueueService, useValue: auditQueue },
      ],
    }).compile();

    service = module.get(AuditLoggerService);
  });

  it('persiste correlationId al registrar evento', async () => {
    service.log({
      accion: 'login',
      modulo: 'autenticacion',
      entidad: 'sesion',
      descripcion: 'Inicio de sesión exitoso',
      usuarioNombre: 'Admin',
      correlationId: 'corr-test-001',
      ip: '127.0.0.1',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'corr-test-001' }),
    );
  });

  it('registra login sin contraseña en detalle', async () => {
    const req = {
      headers: { 'x-correlation-id': 'login-corr', 'user-agent': 'jest' },
      ip: '10.0.0.1',
      socket: {},
    } as unknown as Request;

    service.logLogin(req, 'success', {
      usuarioId: 1,
      usuarioNombre: 'Ana Admin',
      usuarioRol: 'ADMIN',
    }, {
      username: 'admin',
      password: 'secret123',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'login',
        correlationId: 'login-corr',
        detalle: expect.objectContaining({
          username: 'admin',
          password: '[redactado]',
        }),
      }),
    );
  });

  it('no propaga errores de persistencia', () => {
    auditLogsService.create.mockRejectedValueOnce(new Error('DB down'));
    expect(() =>
      service.log({
        accion: 'logout',
        modulo: 'autenticacion',
        entidad: 'sesion',
        descripcion: 'Cierre de sesión',
      }),
    ).not.toThrow();
    expect(auditQueue.enqueue).toHaveBeenCalled();
  });
});
