import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PasswordRecoveryService } from './password-recovery.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { Institution } from '../institution/entities/institution.entity';
import { MailService } from '../mail/mail.service';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { PasswordRecoveryRateLimiterService } from './password-recovery-rate-limiter.service';
import { generateResetToken, hashPassword, hashResetToken } from './utils/password-crypto.util';

describe('PasswordRecoveryService', () => {
  let service: PasswordRecoveryService;
  const tokenRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
    manager: {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: () => ({
            save: jest.fn(),
          }),
          query: jest.fn(),
        }),
      ),
    },
  };
  const usersService = {
    findByEmail: jest.fn(),
    findAuthUserById: jest.fn(),
    updatePasswordAndInvalidateSessions: jest.fn(),
  };
  const mailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true }) };
  const auditLogger = { log: jest.fn() };
  const rateLimiter = { assertAllowed: jest.fn() };
  const institutionRepo = {
    findOne: jest.fn().mockResolvedValue({ nombre: 'IE Demo', siglas: '', ruc: '', codigoModular: '', direccion: '', anio: 2026, ugel: '', dre: '' }),
    save: jest.fn(),
    create: jest.fn((v) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        { provide: getRepositoryToken(PasswordResetToken), useValue: tokenRepo },
        { provide: getRepositoryToken(Institution), useValue: institutionRepo },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: AuditLoggerService, useValue: auditLogger },
        { provide: PasswordRecoveryRateLimiterService, useValue: rateLimiter },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:4200') },
        },
      ],
    }).compile();

    service = module.get(PasswordRecoveryService);
  });

  it('forgotPassword responde mensaje genérico aunque no exista usuario', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    const req = { ip: '127.0.0.1', headers: {} } as any;
    const res = await service.forgotPassword({ email: 'x@test.com' }, req);
    expect(res.accepted).toBe(true);
    expect(res.message).toContain('Si el correo');
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('forgotPassword emite token y correo para usuario activo', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      email: 'u@test.com',
      nombres: 'Ana',
      apellidos: 'Perez',
      rol: 'DOCENTE',
      estado: 'activo',
    });
    tokenRepo.find.mockResolvedValue([]);
    tokenRepo.save.mockResolvedValue({});
    const req = { ip: '127.0.0.1', headers: {} } as any;

    const res = await service.forgotPassword({ email: 'u@test.com' }, req);
    expect(res.accepted).toBe(true);
    expect(tokenRepo.save).toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalled();
  });

  it('resetPassword rechaza token inválido', async () => {
    tokenRepo.findOne.mockResolvedValue(null);
    const req = { ip: '127.0.0.1', headers: {} } as any;
    await expect(
      service.resetPassword(
        { token: 'bad', passwordNuevo: 'Clave1234', confirmPassword: 'Clave1234' },
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resetPassword actualiza contraseña con token válido', async () => {
    const raw = generateResetToken();
    const record = {
      id: 10,
      userId: 2,
      tokenHash: hashResetToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    tokenRepo.findOne.mockResolvedValue(record);
    usersService.findAuthUserById.mockResolvedValue({
      id: 2,
      email: 'u@test.com',
      rol: 'DOCENTE',
      estado: 'activo',
      password: hashPassword('Anterior1'),
    });

    const req = { ip: '127.0.0.1', headers: {} } as any;
    const res = await service.resetPassword(
      { token: raw, passwordNuevo: 'Clave1234', confirmPassword: 'Clave1234' },
      req,
    );
    expect(res.success).toBe(true);
    expect(usersService.updatePasswordAndInvalidateSessions).toHaveBeenCalled();
  });
});
