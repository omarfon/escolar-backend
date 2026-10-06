import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { StudentsService } from '../students/students.service';
import { CompetencyChangeAuditService } from './competency-change-audit.service';
import { CompetencyChangeLog } from './entities/competency-change-log.entity';

describe('CompetencyChangeAuditService', () => {
  let service: CompetencyChangeAuditService;
  const save = jest.fn().mockResolvedValue({ id: 1 });
  const create = jest.fn((v) => v);
  const qb = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    save.mockClear();
    create.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetencyChangeAuditService,
        {
          provide: getRepositoryToken(CompetencyChangeLog),
          useValue: {
            save,
            create,
            createQueryBuilder: jest.fn(() => qb),
          },
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn((v) => v) },
        },
        {
          provide: StudentsService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CompetencyChangeAuditService);
  });

  it('registra cambio con contexto de actor', async () => {
    await service.recordChange(
      'actualizar',
      {
        id: 10,
        studentId: 1,
        competenciaId: 2,
        curriculumId: 3,
        bimestre: 1,
        anio: 2025,
        institutionId: 1,
      },
      { nivelLogro: { anterior: 'B', nuevo: 'A' } },
      { actorUserId: 99, actorNombre: 'admin', actorRol: 'ADMIN', motivo: 'Rectificación' },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'actualizar',
        actorUserId: 99,
        actorNombre: 'admin',
        motivo: 'Rectificación',
        cambios: { nivelLogro: { anterior: 'B', nuevo: 'A' } },
      }),
    );
    expect(save).toHaveBeenCalled();
  });
});
