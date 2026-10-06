import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { REPRESENTANTE_VACIO, Student } from './entities/student.entity';
import { StudentChangeLog } from './entities/student-change-log.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import { StudentSensitiveNotificationService } from './student-sensitive-notification.service';

describe('StudentChangeAuditService', () => {
  let service: StudentChangeAuditService;
  let logRepo: jest.Mocked<Repository<StudentChangeLog>>;

  const student = {
    id: 10,
    codigo: 'EST010',
    nombre: 'Ana',
    apellido: 'Perez',
    apellidoPaterno: 'Perez',
    apellidoMaterno: 'Lopez',
    email: 'ana@test.com',
    nivel: 'Secundaria',
    grado: '3ro',
    seccion: 'A',
    activo: true,
    dni: '12345678',
    tipoDocumento: 'DNI',
    fechaNac: '2010-01-01',
    sexo: 'F' as const,
    direccion: '',
    distrito: '',
    provincia: '',
    departamento: '',
    telefonoEmergencia: '',
    foto: '',
    grupoSanguineo: 'O+',
    alergias: '',
    condicionesSalud: '',
    observaciones: '',
    anioIngreso: '2026',
    estadoMatricula: 'activo' as const,
    estadoCambioSeccion: 'elegible' as const,
    conductaNota: 'AD',
    padre: { ...REPRESENTANTE_VACIO },
    madre: { ...REPRESENTANTE_VACIO },
    apoderado: { ...REPRESENTANTE_VACIO },
  } as Student;

  beforeEach(async () => {
    logRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn((v) => v),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<StudentChangeLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentChangeAuditService,
        {
          provide: getRepositoryToken(StudentChangeLog),
          useValue: logRepo,
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              nombre: 'IE Demo',
              siglas: 'IED',
              anio: 2026,
              ugel: 'UGEL 01',
              dre: 'DRE LM',
            }),
          },
        },
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
        {
          provide: StudentSensitiveNotificationService,
          useValue: { processSensitiveChanges: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(StudentChangeAuditService);
  });

  it('getContext expone institución y retención', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.nombre).toBe('IE Demo');
    expect(ctx.retencionDias).toBeGreaterThan(0);
  });

  it('recordUpdate omite persistencia si no hay cambios', async () => {
    await service.recordUpdate(student, student);
    expect(logRepo.save).not.toHaveBeenCalled();
  });

  it('recordUpdate persiste diff cuando hay cambios', async () => {
    logRepo.findOne.mockResolvedValue(null);
    logRepo.save.mockResolvedValue({ id: 1 } as StudentChangeLog);

    const before = { ...student, seccion: 'A' } as Student;
    const after = { ...student, seccion: 'B' } as Student;

    await service.recordUpdate(after, before);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 10,
        accion: 'actualizar',
        cambios: expect.objectContaining({
          seccion: { anterior: 'A', nuevo: 'B' },
        }),
      }),
    );
  });

  it('evita duplicados por correlationId', async () => {
    logRepo.findOne.mockResolvedValue({ id: 99 } as StudentChangeLog);

    const before = { ...student, seccion: 'A' } as Student;
    const after = { ...student, seccion: 'B' } as Student;

    await service.recordUpdate(after, before, {
      req: {
        headers: { authorization: 'Bearer x', 'x-correlation-id': 'corr-1' },
        user: { id: 1, nombre: 'Admin', rolPrincipal: 'ADMIN', permisos: [] },
      } as never,
    });

    expect(logRepo.save).not.toHaveBeenCalled();
  });
});
