import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { EnrollmentFeedback } from './entities/enrollment-feedback.entity';
import { EnrollmentFeedbackService } from './enrollment-feedback.service';

describe('EnrollmentFeedbackService', () => {
  let service: EnrollmentFeedbackService;
  let feedbackRepo: jest.Mocked<Repository<EnrollmentFeedback>>;
  let evaluationRepo: jest.Mocked<Repository<EnrollmentEvaluation>>;
  let dataSource: { transaction: jest.Mock };

  const evaluation = {
    id: 5,
    anioEscolar: 2026,
    waitlistEntryId: 3,
    studentId: null,
    candidatoNombre: 'Perez, Ana',
    candidatoDni: '71234567',
    tipoEvaluacion: 'Entrevista con apoderado',
    resultado: 'aprobado',
  } as EnrollmentEvaluation;

  beforeEach(async () => {
    feedbackRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<EnrollmentFeedback>>;

    evaluationRepo = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<EnrollmentEvaluation>>;

    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentFeedbackService,
        {
          provide: getRepositoryToken(EnrollmentFeedback),
          useValue: feedbackRepo,
        },
        {
          provide: getRepositoryToken(EnrollmentEvaluation),
          useValue: evaluationRepo,
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              nombre: 'IE Demo',
              siglas: 'IED',
              anio: '2026',
            }),
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
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(EnrollmentFeedbackService);
  });

  it('marca elegible evaluación sin retroalimentación previa', async () => {
    evaluationRepo.findOneBy.mockResolvedValue(evaluation);
    feedbackRepo.findOne.mockResolvedValue(null);

    const elig = await service.getEligibility(5);
    expect(elig.elegible).toBe(true);
  });

  it('rechaza evaluación inexistente', async () => {
    evaluationRepo.findOneBy.mockResolvedValue(null);
    await expect(service.getEligibility(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('registra retroalimentación', async () => {
    evaluationRepo.findOneBy.mockResolvedValue(evaluation);
    feedbackRepo.findOne.mockResolvedValue(null);

    const saved: EnrollmentFeedback = {
      id: 1,
      anioEscolar: 2026,
      enrollmentEvaluationId: 5,
      waitlistEntryId: 3,
      studentId: null,
      candidatoNombre: 'Perez, Ana',
      candidatoDni: '71234567',
      tipoEvaluacion: 'Entrevista con apoderado',
      resultadoEvaluacion: 'aprobado',
      canal: 'Presencial',
      fechaRetroalimentacion: '2026-06-20',
      destinatario: 'María Pérez',
      mensaje: 'Se comunica resultado favorable de la evaluación de admisión.',
      acuseRecibo: true,
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: {},
      ip: '',
      correlationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dataSource.transaction.mockImplementation(
      (cb: (manager: unknown) => Promise<EnrollmentFeedback>) => {
        const manager = {
          getRepository: () => ({
            findOne: jest.fn().mockResolvedValue(null),
            create: (data: Partial<EnrollmentFeedback>) => data,
            save: (data: EnrollmentFeedback) =>
              Promise.resolve({ ...saved, ...data, id: 1 }),
          }),
        };
        return cb(manager);
      },
    );

    const result = await service.register({
      enrollmentEvaluationId: 5,
      canal: 'Presencial',
      fechaRetroalimentacion: '2026-06-20',
      destinatario: 'María Pérez',
      mensaje: 'Se comunica resultado favorable de la evaluación de admisión.',
      acuseRecibo: true,
    });

    expect(result.id).toBe(1);
    expect(result.canal).toBe('Presencial');
  });

  it('impide duplicado', async () => {
    evaluationRepo.findOneBy.mockResolvedValue(evaluation);
    feedbackRepo.findOne.mockResolvedValue({ id: 1 } as EnrollmentFeedback);

    await expect(
      service.register({
        enrollmentEvaluationId: 5,
        canal: 'Presencial',
        fechaRetroalimentacion: '2026-06-20',
        destinatario: 'María Pérez',
        mensaje:
          'Se comunica resultado favorable de la evaluación de admisión.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
