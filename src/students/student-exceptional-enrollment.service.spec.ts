import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { Student } from './entities/student.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import { StudentExceptionalEnrollmentService } from './student-exceptional-enrollment.service';
import { StudentsService } from './students.service';

describe('StudentExceptionalEnrollmentService', () => {
  let service: StudentExceptionalEnrollmentService;
  let studentRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    studentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 99, ...data })),
      save: jest.fn(async (s) => s),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentExceptionalEnrollmentService,
        {
          provide: getRepositoryToken(Student),
          useValue: studentRepo,
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 1, anio: '2026', nombre: 'IE Demo' }),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: StudentsService,
          useValue: {
            findExpediente: jest.fn().mockResolvedValue({ id: 99, matriculaExcepcional: true }),
          },
        },
        {
          provide: StudentChangeAuditService,
          useValue: { recordCreate: jest.fn() },
        },
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(StudentExceptionalEnrollmentService);
  });

  it('expone contexto con fecha de corte normativa', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.fechaCorteNormativa).toBe('2026-03-31');
    expect(ctx.motivos.length).toBeGreaterThan(0);
  });

  it('detecta edad fuera de normativa', async () => {
    const check = await service.checkAge({
      fechaNac: '2010-01-01',
      gradoLabel: '2° Primaria',
    });
    expect(check.requiereExcepcional).toBe(true);
    expect(check.cumpleEdadNormativa).toBe(false);
  });

  it('rechaza registro si la edad cumple normativa', async () => {
    await expect(
      service.register({
        nombres: 'Ana',
        apellidos: 'Perez',
        dni: '71234567',
        fechaNac: '2018-04-01',
        gradoLabel: '2° Primaria',
        seccion: 'A',
        excepcionalMotivo: 'Traslado externo con diferencia de edad',
        excepcionalSustento: 'Resolución directoral N° 001-2026',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registra matrícula excepcional con edad fuera de normativa', async () => {
    const res = await service.register({
      nombres: 'Luis',
      apellidos: 'Gomez',
      dni: '80123456',
      fechaNac: '2010-01-01',
      gradoLabel: '2° Primaria',
      seccion: 'B',
      excepcionalMotivo: 'Rezagado con resolución directoral',
      excepcionalSustento: 'Resolución directoral N° 002-2026 con informe',
      confirmarDuplicado: true,
    });
    expect(res.matriculaExcepcional).toBe(true);
    expect(studentRepo.save).toHaveBeenCalled();
  });

  it('rechaza duplicados sin confirmación', async () => {
    studentRepo.find.mockResolvedValue([
      {
        id: 1,
        nombre: 'Luis',
        apellido: 'Gomez',
        fechaNac: '2010-01-01',
        sexo: 'M',
        codigo: '2026-001',
        estadoDocumento: 'regular',
        apellidoPaterno: '',
        apellidoMaterno: '',
        padre: {},
        madre: {},
        apoderado: {},
      },
    ]);

    await expect(
      service.register({
        nombres: 'Luis',
        apellidos: 'Gomez',
        dni: '80123457',
        fechaNac: '2010-01-01',
        sexo: 'M',
        gradoLabel: '2° Primaria',
        seccion: 'B',
        excepcionalMotivo: 'Rezagado con resolución directoral',
        excepcionalSustento: 'Resolución directoral N° 003-2026 con informe',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
