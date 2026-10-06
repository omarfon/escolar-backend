import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { StudentsService } from '../students/students.service';
import { DiagnosticChangeAuditService } from './diagnostic-change-audit.service';
import { DiagnosticChangeLog } from './entities/diagnostic-change-log.entity';
import { DiagnosticEvaluation } from './entities/diagnostic-evaluation.entity';

describe('DiagnosticChangeAuditService', () => {
  let service: DiagnosticChangeAuditService;
  let logRepo: jest.Mocked<Repository<DiagnosticChangeLog>>;

  const evaluation = {
    id: 3,
    studentId: 12,
    curso: 'Comunicación',
    bimestre: 1,
    anio: 2026,
    institutionId: 1,
    nota: 14,
    nivelLogro: null,
    observacion: null,
    fechaEvaluacion: '2026-03-15',
  } as DiagnosticEvaluation;

  beforeEach(async () => {
    logRepo = {
      save: jest.fn(),
      create: jest.fn((v) => v),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<DiagnosticChangeLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosticChangeAuditService,
        { provide: getRepositoryToken(DiagnosticChangeLog), useValue: logRepo },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              nombre: 'IE Demo',
              siglas: 'IED',
              anio: 2026,
            }),
          },
        },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
        { provide: StudentsService, useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(DiagnosticChangeAuditService);
  });

  it('getContext expone permiso de consulta', async () => {
    const ctx = await service.getContext();
    expect(ctx.permisoConsulta).toBe('evaluacion.reportes');
  });

  it('recordCreate persiste acción crear', async () => {
    await service.recordCreate(evaluation, { motivo: 'Registro diagnóstico' });
    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'crear',
        motivo: 'Registro diagnóstico',
        cambios: expect.objectContaining({
          nota: { nuevo: 14 },
        }),
      }),
    );
  });
});
