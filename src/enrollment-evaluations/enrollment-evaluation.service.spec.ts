import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { Student } from '../students/entities/student.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { EnrollmentEvaluation } from './entities/enrollment-evaluation.entity';
import { EnrollmentEvaluationService } from './enrollment-evaluation.service';

describe('EnrollmentEvaluationService', () => {
  let service: EnrollmentEvaluationService;
  let evaluationRepo: jest.Mocked<Repository<EnrollmentEvaluation>>;
  let waitlistRepo: jest.Mocked<Repository<WaitlistEntry>>;
  let studentRepo: jest.Mocked<Repository<Student>>;
  let dataSource: { transaction: jest.Mock };

  const institution = {
    id: 1,
    nombre: 'IE Demo',
    siglas: 'IED',
    anio: '2026',
    ugel: 'UGEL 01',
    dre: 'DRE LM',
    codigoModular: '1234567',
  };

  const waitlistEntry = {
    id: 3,
    nombres: 'Ana',
    apellidos: 'Perez',
    dni: '71234567',
    nivel: 'Primaria',
    grado: '1°',
    seccionDeseada: 'A',
    estado: 'en_espera',
    studentId: null,
  } as WaitlistEntry;

  beforeEach(async () => {
    evaluationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<EnrollmentEvaluation>>;

    waitlistRepo = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<WaitlistEntry>>;

    studentRepo = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<Student>>;

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentEvaluationService,
        {
          provide: getRepositoryToken(EnrollmentEvaluation),
          useValue: evaluationRepo,
        },
        {
          provide: getRepositoryToken(WaitlistEntry),
          useValue: waitlistRepo,
        },
        {
          provide: getRepositoryToken(Student),
          useValue: studentRepo,
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue(institution),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: PeriodosAcademicosMaestrosService,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([
                { inicio: '2026-03-01', fin: '2026-12-15', activo: true },
              ]),
          },
        },
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(EnrollmentEvaluationService);
  });

  it('expone contexto institucional', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.anioEscolar).toBe(2026);
    expect(ctx.permisoRegistrar).toBe('matricula.evaluacion');
    expect(ctx.tiposEvaluacion.length).toBeGreaterThan(0);
  });

  it('marca elegible candidato en lista de espera activa', async () => {
    waitlistRepo.findOneBy.mockResolvedValue(waitlistEntry);
    evaluationRepo.find.mockResolvedValue([]);

    const elig = await service.getWaitlistEligibility(3);
    expect(elig.elegible).toBe(true);
    expect(elig.tiposDisponibles.length).toBeGreaterThan(0);
  });

  it('rechaza candidato con solicitud cancelada', async () => {
    waitlistRepo.findOneBy.mockResolvedValue({
      ...waitlistEntry,
      estado: 'cancelado',
    });
    evaluationRepo.find.mockResolvedValue([]);

    const elig = await service.getWaitlistEligibility(3);
    expect(elig.elegible).toBe(false);
    expect(elig.motivoInelegible).toContain('activas');
  });

  it('registra evaluación para lista de espera', async () => {
    waitlistRepo.findOneBy.mockResolvedValue(waitlistEntry);
    evaluationRepo.find.mockResolvedValue([]);
    evaluationRepo.findOne.mockResolvedValue(null);

    const saved = {
      id: 10,
      anioEscolar: 2026,
      origen: 'waitlist',
      waitlistEntryId: 3,
      studentId: null,
      candidatoNombre: 'Perez, Ana',
      candidatoDni: '71234567',
      nivel: 'Primaria',
      grado: '1°',
      seccionDeseada: 'A',
      tipoEvaluacion: 'Entrevista con apoderado',
      fechaEvaluacion: '2026-06-15',
      resultado: 'aprobado',
      puntaje: 16,
      observaciones: '',
      resolucion: 'Resolución directoral N.° 001-2026',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: {},
      ip: '127.0.0.1',
      correlationId: null,
      createdAt: new Date('2026-06-15'),
    } as EnrollmentEvaluation;

    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<EnrollmentEvaluation>) => {
        const manager = {
          getRepository: () => ({
            findOne: jest.fn().mockResolvedValue(null),
            create: (data: Partial<EnrollmentEvaluation>) => data,
            save: (data: EnrollmentEvaluation) =>
              Promise.resolve({ ...saved, ...data }),
          }),
        };
        return cb(manager);
      },
    );

    const result = await service.register({
      waitlistEntryId: 3,
      tipoEvaluacion: 'Entrevista con apoderado',
      fechaEvaluacion: '2026-06-15',
      resultado: 'aprobado',
      puntaje: 16,
      resolucion: 'Resolución directoral N.° 001-2026',
    });

    expect(result.id).toBe(10);
    expect(result.resultado).toBe('aprobado');
  });

  it('impide registrar sin candidato', async () => {
    await expect(
      service.register({
        tipoEvaluacion: 'Entrevista con apoderado',
        fechaEvaluacion: '2026-06-15',
        resultado: 'aprobado',
        resolucion: 'Resolución directoral N.° 001-2026',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza not found si waitlist no existe', async () => {
    waitlistRepo.findOneBy.mockResolvedValue(null);
    await expect(service.getWaitlistEligibility(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reutiliza registro existente con el mismo correlationId', async () => {
    const existing = {
      id: 11,
      anioEscolar: 2026,
      origen: 'waitlist',
      waitlistEntryId: 3,
      studentId: null,
      candidatoNombre: 'Perez, Ana',
      candidatoDni: '71234567',
      nivel: 'Primaria',
      grado: '1°',
      seccionDeseada: 'A',
      tipoEvaluacion: 'Entrevista con apoderado',
      fechaEvaluacion: '2026-06-15',
      resultado: 'aprobado',
      puntaje: 16,
      observaciones: '',
      resolucion: 'Resolución directoral N.° 001-2026',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: {},
      ip: '127.0.0.1',
      correlationId: 'corr-123',
      createdAt: new Date('2026-06-15'),
    } as EnrollmentEvaluation;

    evaluationRepo.findOne.mockResolvedValue(existing);

    const req = {
      headers: { 'x-correlation-id': 'corr-123' },
    } as import('express').Request;

    const result = await service.register(
      {
        waitlistEntryId: 3,
        tipoEvaluacion: 'Entrevista con apoderado',
        fechaEvaluacion: '2026-06-15',
        resultado: 'aprobado',
        resolucion: 'Resolución directoral N.° 001-2026',
      },
      req,
    );

    expect(result.id).toBe(11);
    expect(result.duplicadoIdempotente).toBe(true);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('impide duplicado de tipo evaluación', async () => {
    waitlistRepo.findOneBy.mockResolvedValue(waitlistEntry);
    evaluationRepo.find.mockResolvedValue([
      {
        tipoEvaluacion: 'Entrevista con apoderado',
      } as EnrollmentEvaluation,
    ]);

    await expect(
      service.register({
        waitlistEntryId: 3,
        tipoEvaluacion: 'Entrevista con apoderado',
        fechaEvaluacion: '2026-06-15',
        resultado: 'aprobado',
        resolucion: 'Resolución directoral N.° 001-2026',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
