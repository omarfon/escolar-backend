import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Institution } from '../institution/entities/institution.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { Student } from '../students/entities/student.entity';
import { RepresentativeLinkLog } from './entities/representative-link-log.entity';
import { RepresentativeStudentLink } from './entities/representative-student-link.entity';
import { Representative } from './entities/representative.entity';
import { RepresentativeLinksService } from './representative-links.service';

describe('RepresentativeLinksService', () => {
  let service: RepresentativeLinksService;

  const representativeRepo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
  const linkRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 10, vigenciaDesde: '2026-01-01', ...v })),
    createQueryBuilder: jest.fn(),
  };
  const logRepo = {
    createQueryBuilder: jest.fn(),
  };
  const studentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (v) => v),
  };
  const parentStudentRepo = {
    findOne: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
    delete: jest.fn(),
  };
  const institutionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
  };
  const auditLogger = { log: jest.fn() };

  const transactionMock = jest.fn(async (cb) =>
    cb({
      getRepository: (entity: unknown) => {
        if (entity === Representative) return representativeRepo;
        if (entity === RepresentativeStudentLink) return linkRepo;
        if (entity === Student) return studentRepo;
        if (entity === ParentStudent) return parentStudentRepo;
        if (entity === RepresentativeLinkLog) {
          return {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => v),
          };
        }
        return {};
      },
    }),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    linkRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    });
    logRepo.createQueryBuilder.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    institutionRepo.findOne.mockResolvedValue({
      nombre: 'IE Demo',
      siglas: 'IED',
      anio: '2026',
      ugel: 'UGEL 01',
      dre: 'DRE LM',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepresentativeLinksService,
        { provide: getRepositoryToken(Representative), useValue: representativeRepo },
        { provide: getRepositoryToken(RepresentativeStudentLink), useValue: linkRepo },
        { provide: getRepositoryToken(RepresentativeLinkLog), useValue: logRepo },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: getRepositoryToken(ParentStudent), useValue: parentStudentRepo },
        { provide: getRepositoryToken(Institution), useValue: institutionRepo },
        { provide: AuditLoggerService, useValue: auditLogger },
        {
          provide: DataSource,
          useValue: { transaction: transactionMock },
        },
      ],
    }).compile();

    service = module.get(RepresentativeLinksService);
  });

  it('findByDocument exige número de documento', async () => {
    await expect(service.findByDocument('DNI', '  ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('associateStudents crea representante y vínculo', async () => {
    representativeRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, tipoDocumento: 'DNI', numeroDocumento: '12345678' });
    representativeRepo.findOneOrFail.mockResolvedValue({
      id: 1,
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 5,
      nombre: 'Ana',
      apellido: 'Perez',
      nivel: 'Primaria',
      grado: '1',
      seccion: 'A',
      codigo: 'E0005',
      activo: true,
    });
    linkRepo.findOne.mockResolvedValue(null);

    const result = await service.associateStudents({
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      representante: { nombres: 'Juan', apellidos: 'Perez', email: 'juan@test.pe' },
      studentIds: [5],
      tipoVinculo: 'apoderado',
      esPrincipal: true,
      motivo: 'Actualización familiar',
    });

    expect(result.creados).toHaveLength(1);
    expect(result.omitidos).toHaveLength(0);
    expect(auditLogger.log).toHaveBeenCalled();
  });

  it('associateStudents omite duplicado activo', async () => {
    representativeRepo.findOne
      .mockResolvedValueOnce({
        id: 1,
        tipoDocumento: 'DNI',
        numeroDocumento: '87654321',
      })
      .mockResolvedValueOnce({
        id: 1,
        tipoDocumento: 'DNI',
        numeroDocumento: '87654321',
      });
    representativeRepo.findOneOrFail.mockResolvedValue({
      id: 1,
      tipoDocumento: 'DNI',
      numeroDocumento: '87654321',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 7,
      nombre: 'Luis',
      apellido: 'Garcia',
      nivel: 'Primaria',
      grado: '2',
      seccion: 'B',
      codigo: 'E0007',
      activo: true,
    });
    linkRepo.findOne.mockResolvedValue({ id: 99, activo: true });

    const result = await service.associateStudents({
      tipoDocumento: 'DNI',
      numeroDocumento: '87654321',
      representante: { nombres: 'Maria' },
      studentIds: [7],
      tipoVinculo: 'madre',
      motivo: 'Reasignación',
    });

    expect(result.creados).toHaveLength(0);
    expect(result.omitidos[0].razon).toContain('vínculo activo');
  });
});
