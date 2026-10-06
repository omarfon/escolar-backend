import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLoggerService } from '../../audit-logs/audit-logger.service';
import { Announcement } from '../../announcements/entities/announcement.entity';
import { Evento } from '../../events/entities/evento.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { MaestroFeriado } from '../feriados/entities/maestro-feriado.entity';
import { MaestroPeriodoAcademico } from '../periodos-academicos/entities/maestro-periodo-academico.entity';
import { PeriodosAcademicosMaestrosService } from '../periodos-academicos/periodos-academicos.service';
import { MaestroAnioEscolarEvent } from './entities/maestro-anio-escolar-event.entity';
import { MaestroAnioEscolar } from './entities/maestro-anio-escolar.entity';
import { AniosEscolaresService } from './anios-escolares.service';

describe('AniosEscolaresService', () => {
  let service: AniosEscolaresService;
  const anioRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((row: object) => row),
    save: jest.fn(async (row: MaestroAnioEscolar) => ({ id: 1, ...row })),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AniosEscolaresService,
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((fn: (m: unknown) => unknown) =>
              fn({
                getRepository: (entity: unknown) => {
                  if (entity === MaestroAnioEscolar) return anioRepo;
                  if (entity === MaestroAnioEscolarEvent) {
                    return { create: jest.fn((r) => r), save: jest.fn(async (r) => r) };
                  }
                  if (entity === Institution) {
                    return {
                      findOneBy: jest.fn().mockResolvedValue({
                        id: 1,
                        nombre: 'IE Demo',
                        anio: '2026',
                        tipoPeriodo: 'bimestre',
                        periodos: [],
                      }),
                      save: jest.fn(async (r) => r),
                    };
                  }
                  if (entity === Announcement) {
                    return {
                      create: jest.fn((r) => r),
                      save: jest.fn(async (r) => ({ id: 99, ...r })),
                    };
                  }
                  if (entity === Evento) {
                    return {
                      createQueryBuilder: jest.fn(() => ({
                        update: jest.fn().mockReturnThis(),
                        set: jest.fn().mockReturnThis(),
                        where: jest.fn().mockReturnThis(),
                        andWhere: jest.fn().mockReturnThis(),
                        execute: jest.fn().mockResolvedValue(undefined),
                      })),
                    };
                  }
                  throw new Error('repo no mock');
                },
              }),
            ),
          },
        },
        { provide: getRepositoryToken(MaestroAnioEscolar), useValue: anioRepo },
        {
          provide: getRepositoryToken(MaestroAnioEscolarEvent),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            })),
          },
        },
        {
          provide: getRepositoryToken(MaestroFeriado),
          useValue: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getRepositoryToken(MaestroPeriodoAcademico),
          useValue: {
            find: jest.fn().mockResolvedValue([
              {
                id: 1,
                numero: 1,
                nombre: 'I Bimestre',
                inicio: '2028-03-01',
                fin: '2028-05-15',
                anioEscolar: 2028,
                activo: true,
              },
            ]),
          },
        },
        {
          provide: getRepositoryToken(Announcement),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((r) => r),
            save: jest.fn(async (r) => ({ id: 99, ...r })),
          },
        },
        {
          provide: getRepositoryToken(Evento),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getCount: jest.fn().mockResolvedValue(2),
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue(undefined),
            })),
          },
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              nombre: 'IE Demo',
              siglas: 'IED',
              anio: '2026',
              ugel: 'UGEL 01',
              dre: 'DRE Lima',
              codigoModular: '1234567',
            }),
            findOneBy: jest.fn().mockResolvedValue({ id: 1, anio: '2026' }),
          },
        },
        { provide: PeriodosAcademicosMaestrosService, useValue: { syncFromInstitution: jest.fn() } },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AniosEscolaresService);
  });

  const actor = {
    req: { headers: {}, ip: '127.0.0.1' } as never,
    permisos: ['calendarizacion.gestionar', 'comunicados.enviar'],
    ambitos: ['IE'],
    esAdmin: false,
    institutionId: 1,
  };

  it('rechaza registro sin permiso', async () => {
    await expect(
      service.create(
        {
          anio: 2028,
          fechaInicio: '2028-03-01',
          fechaFin: '2028-12-20',
          tipoPeriodo: 'bimestre',
        },
        { ...actor, permisos: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide duplicar año escolar', async () => {
    anioRepo.findOne.mockImplementation(async (opts: { where: { anio?: number } }) => {
      if (opts.where.anio === 2028) return { id: 9, anio: 2028 } as MaestroAnioEscolar;
      return null;
    });
    await expect(
      service.create(
        {
          anio: 2028,
          fechaInicio: '2028-03-01',
          fechaFin: '2028-12-20',
          tipoPeriodo: 'bimestre',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registra año escolar en planificado', async () => {
    anioRepo.findOne.mockResolvedValue(null);
    anioRepo.find.mockResolvedValue([]);
    const result = await service.create(
      {
        anio: 2029,
        fechaInicio: '2029-03-01',
        fechaFin: '2029-12-20',
        tipoPeriodo: 'bimestre',
        motivo: 'Planificación calendarización 2029',
      },
      actor,
    );
    expect(result.anio).toBe(2029);
    expect(result.estado).toBe('planificado');
  });

  it('rechaza copiar calendario sin permiso', async () => {
    await expect(
      service.copyCalendario(1, {}, { ...actor, permisos: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza publicar comunicado sin permiso de comunicados', async () => {
    anioRepo.findOneBy.mockResolvedValue({
      id: 1,
      anio: 2028,
      institutionId: 1,
      estado: 'activo',
      fechaInicio: '2028-03-01',
      fechaFin: '2028-12-20',
      publicado: false,
      version: 1,
      activo: true,
    } as MaestroAnioEscolar);

    await expect(
      service.publicarComunicado(
        1,
        {},
        { ...actor, permisos: ['calendarizacion.gestionar'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publica comunicado del calendario', async () => {
    anioRepo.findOneBy.mockResolvedValue({
      id: 1,
      anio: 2028,
      institutionId: 1,
      estado: 'activo',
      fechaInicio: '2028-03-01',
      fechaFin: '2028-12-20',
      tipoPeriodo: 'bimestre',
      publicado: false,
      version: 1,
      activo: true,
    } as MaestroAnioEscolar);

    const result = await service.publicarComunicado(
      1,
      { destinatarios: 'todos', motivo: 'Publicación oficial' },
      actor,
    );

    expect(result.comunicado.id).toBe(99);
    expect(result.anioEscolar.publicado).toBe(true);
    expect(result.version).toBe(2);
  });

  it('rechaza copiar calendario si el destino no está planificado', async () => {
    anioRepo.findOneBy.mockResolvedValue({
      id: 1,
      anio: 2028,
      institutionId: 1,
      estado: 'activo',
      fechaInicio: '2028-03-01',
      fechaFin: '2028-12-20',
      activo: true,
    } as MaestroAnioEscolar);
    await expect(service.copyCalendario(1, {}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
