import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLoggerService } from '../../audit-logs/audit-logger.service';
import { CatalogCacheService } from '../../common/catalog-cache.service';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';
import { MaestroPeriodoAcademico } from './entities/maestro-periodo-academico.entity';
import { PeriodosAcademicosMaestrosService } from './periodos-academicos.service';

describe('PeriodosAcademicosMaestrosService', () => {
  let service: PeriodosAcademicosMaestrosService;

  const tenantCtx = {
    req: { user: { institutionId: 1, roles: ['ADMIN'] }, headers: {}, query: {} },
  };

  const periodoRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const anioEscolarRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodosAcademicosMaestrosService,
        { provide: getRepositoryToken(MaestroPeriodoAcademico), useValue: periodoRepo },
        { provide: getRepositoryToken(MaestroAnioEscolar), useValue: anioEscolarRepo },
        { provide: DataSource, useValue: { getRepository: jest.fn() } },
        { provide: CatalogCacheService, useValue: { wrap: (_k, fn) => fn(), invalidate: jest.fn() } },
        { provide: AuditLoggerService, useValue: { log: jest.fn(), logFromRequestContext: jest.fn() } },
      ],
    }).compile();

    service = module.get(PeriodosAcademicosMaestrosService);
  });

  describe('dividirPeriodos', () => {
    it('genera bimestres cuando el año no tiene periodos', async () => {
      anioEscolarRepo.findOne.mockResolvedValue({
        anio: 2035,
        tipoPeriodo: 'bimestre',
        fechaInicio: '2035-03-01',
        fechaFin: '2035-12-20',
        estado: 'planificado',
        version: 1,
      });
      periodoRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { id: 1, anioEscolar: 2035, numero: 1, nombre: '1 Bimestre', tipo: 'bimestre', inicio: '2035-03-10', fin: '2035-05-09', actual: false, descripcion: '', activo: true },
      ]);
      periodoRepo.findOne.mockResolvedValue(null);
      periodoRepo.save.mockImplementation(async (x) => ({ id: 1, ...x }));
      anioEscolarRepo.save.mockImplementation(async (x) => x);

      jest.spyOn(service, 'syncFromInstitution').mockResolvedValue(undefined);

      const res = await service.dividirPeriodos({ anioEscolar: 2035 }, tenantCtx);
      expect(res.creados).toBe(4);
      expect(res.tipo).toBe('bimestre');
      expect(res.periodos.length).toBeGreaterThan(0);
    });

    it('rechaza si ya hay periodos sin sobreescribir', async () => {
      anioEscolarRepo.findOne.mockResolvedValue({
        anio: 2035,
        tipoPeriodo: 'bimestre',
        fechaInicio: '2035-03-01',
        fechaFin: '2035-12-20',
        estado: 'planificado',
        version: 1,
      });
      periodoRepo.find.mockResolvedValue([
        { numero: 1, inicio: '2035-03-10', fin: '2035-05-09', tipo: 'bimestre', nombre: 'Otro' },
      ]);

      await expect(
        service.dividirPeriodos({ anioEscolar: 2035 }, tenantCtx),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza año cerrado', async () => {
      anioEscolarRepo.findOne.mockResolvedValue({
        anio: 2030,
        estado: 'cerrado',
        tipoPeriodo: 'bimestre',
        fechaInicio: '2030-03-01',
        fechaFin: '2030-12-20',
        version: 3,
      });

      await expect(
        service.dividirPeriodos({ anioEscolar: 2030 }, tenantCtx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
