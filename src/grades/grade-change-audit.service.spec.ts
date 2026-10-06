import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { Grade } from './entities/grade.entity';
import { GradeChangeLog } from './entities/grade-change-log.entity';
import { GradeChangeAuditService } from './grade-change-audit.service';

describe('GradeChangeAuditService', () => {
  let service: GradeChangeAuditService;
  let logRepo: jest.Mocked<Repository<GradeChangeLog>>;

  const grade = {
    id: 5,
    studentId: 10,
    curso: 'Matemática',
    tipo: 'partial' as const,
    componenteCodigo: 'examen_parcial',
    bimestre: 2,
    nota: 14,
    fechaEvaluacion: '2026-06-01',
  } as Grade;

  const student = { studentCodigo: 'EST010', studentNombre: 'Perez, Ana' };

  beforeEach(async () => {
    logRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn((v) => v),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<GradeChangeLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradeChangeAuditService,
        { provide: getRepositoryToken(GradeChangeLog), useValue: logRepo },
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
      ],
    }).compile();

    service = module.get(GradeChangeAuditService);
  });

  it('getContext expone permisos de evaluación', async () => {
    const ctx = await service.getContext();
    expect(ctx.permisoConsulta).toBe('evaluacion.reportes');
    expect(ctx.permisoExportacion).toBe('evaluacion.exportar');
  });

  it('recordUpdate omite si no hay cambios', async () => {
    await service.recordUpdate(grade, grade, student);
    expect(logRepo.save).not.toHaveBeenCalled();
  });

  it('recordUpdate persiste diff de nota', async () => {
    logRepo.findOne.mockResolvedValue(null);
    logRepo.save.mockResolvedValue({ id: 1 } as GradeChangeLog);

    const before = { ...grade, nota: 14 } as Grade;
    const after = { ...grade, nota: 16 } as Grade;

    await service.recordUpdate(after, before, student);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        gradeId: 5,
        accion: 'actualizar',
        cambios: expect.objectContaining({
          nota: { anterior: 14, nuevo: 16 },
        }),
      }),
    );
  });

  it('recordRectify persiste acción rectificar con motivo', async () => {
    logRepo.findOne.mockResolvedValue(null);
    logRepo.save.mockResolvedValue({ id: 2 } as GradeChangeLog);

    const before = { ...grade, nota: 14 } as Grade;
    const after = { ...grade, nota: 15.5 } as Grade;

    await service.recordRectify(after, before, student, {
      motivo: 'Corrección por error de digitación en acta cerrada',
    });

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'rectificar',
        motivo: 'Corrección por error de digitación en acta cerrada',
        cambios: expect.objectContaining({
          nota: { anterior: 14, nuevo: 15.5 },
        }),
      }),
    );
  });
});
