import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { MailService } from '../mail/mail.service';
import { REPRESENTANTE_VACIO, Student } from './entities/student.entity';
import { StudentSensitiveNotification } from './entities/student-sensitive-notification.entity';
import { StudentSensitiveNotificationService } from './student-sensitive-notification.service';

describe('StudentSensitiveNotificationService', () => {
  let service: StudentSensitiveNotificationService;
  const notifRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (v) => ({ id: 1, createdAt: new Date(), ...v })),
    create: jest.fn((v) => v),
    createQueryBuilder: jest.fn(),
  };
  const mailService = {
    resolveParentEmail: jest.fn().mockReturnValue('apoderado@test.com'),
    sendStudentPersonalDataChangeNotification: jest
      .fn()
      .mockResolvedValue({ sent: true }),
  };
  const auditLogger = { log: jest.fn() };

  const student = {
    id: 5,
    codigo: 'EST005',
    nombre: 'Luis',
    apellido: 'Garcia',
    grado: '4to',
    seccion: 'B',
    apoderado: { ...REPRESENTANTE_VACIO, email: 'apoderado@test.com' },
  } as Student;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentSensitiveNotificationService,
        { provide: getRepositoryToken(StudentSensitiveNotification), useValue: notifRepo },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              nombre: 'IE Demo',
              siglas: 'IED',
              anio: 2026,
            }),
          },
        },
        { provide: MailService, useValue: mailService },
        { provide: AuditLoggerService, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(StudentSensitiveNotificationService);
  });

  it('getContext expone campos sensibles clasificados', async () => {
    const ctx = await service.getContext();
    expect(ctx.camposSensibles.length).toBeGreaterThan(0);
    expect(ctx.permisoConsulta).toBe('estudiantes.expediente');
  });

  it('processSensitiveChanges omite si no hay campos sensibles', async () => {
    const result = await service.processSensitiveChanges(
      student,
      10,
      { seccion: { anterior: 'A', nuevo: 'B' } },
    );
    expect(result).toBeNull();
    expect(notifRepo.save).not.toHaveBeenCalled();
  });

  it('processSensitiveChanges registra y notifica cambios sensibles', async () => {
    notifRepo.findOne.mockResolvedValue(null);

    const result = await service.processSensitiveChanges(
      student,
      11,
      { direccion: { anterior: 'Av. 1', nuevo: 'Av. 2' } },
      { motivo: 'Actualización domicilio' },
    );

    expect(result).toBeDefined();
    expect(notifRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 5,
        camposNotificados: ['direccion'],
        correoEnviado: true,
      }),
    );
    expect(mailService.sendStudentPersonalDataChangeNotification).toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalled();
  });

  it('evita duplicados por studentChangeLogId', async () => {
    notifRepo.findOne.mockResolvedValue({ id: 99 });

    const result = await service.processSensitiveChanges(student, 12, {
      email: { anterior: 'a@x.com', nuevo: 'b@x.com' },
    });

    expect(result?.id).toBe(99);
    expect(notifRepo.save).not.toHaveBeenCalled();
  });
});
