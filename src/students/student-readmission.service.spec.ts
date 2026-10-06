import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { Grade } from '../grades/entities/grade.entity';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { SalonesService } from '../maestros/salones/salones.service';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { StudentReadmission } from './entities/student-readmission.entity';
import { StudentWithdrawal } from './entities/student-withdrawal.entity';
import { Student } from './entities/student.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import { StudentReadmissionService } from './student-readmission.service';

describe('StudentReadmissionService', () => {
  let service: StudentReadmissionService;
  let studentRepo: jest.Mocked<Repository<Student>>;
  let readmissionRepo: jest.Mocked<Repository<StudentReadmission>>;
  let withdrawalRepo: jest.Mocked<Repository<StudentWithdrawal>>;
  let dataSource: { transaction: jest.Mock };

  const student = {
    id: 7,
    codigo: 'EST007',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    activo: true,
    estadoMatricula: 'retirado',
    nivel: 'Secundaria',
    grado: '3°',
    seccion: 'A',
    anioIngreso: '2026',
  } as Student;

  const withdrawal = {
    id: 5,
    studentId: 7,
    anioEscolar: 2026,
    fechaRetiro: '2026-06-15',
  } as StudentWithdrawal;

  const institution = {
    id: 1,
    nombre: 'IE Demo',
    siglas: 'IED',
    anio: '2026',
    ugel: 'UGEL 01',
    dre: 'DRE LM',
    codigoModular: '1234567',
  };

  beforeEach(async () => {
    studentRepo = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<Student>>;

    readmissionRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<StudentReadmission>>;

    withdrawalRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<StudentWithdrawal>>;

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentReadmissionService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(StudentReadmission),
          useValue: readmissionRepo,
        },
        {
          provide: getRepositoryToken(StudentWithdrawal),
          useValue: withdrawalRepo,
        },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        {
          provide: getRepositoryToken(Institution),
          useValue: {
            findOne: jest.fn().mockResolvedValue(institution),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Grade),
          useValue: { count: jest.fn().mockResolvedValue(4) },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: { count: jest.fn().mockResolvedValue(12) },
        },
        { provide: getRepositoryToken(StudentAcademicHistory), useValue: {} },
        {
          provide: PeriodosAcademicosMaestrosService,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([{ inicio: '2026-03-01', fin: '2026-12-15' }]),
          },
        },
        {
          provide: SalonesService,
          useValue: {
            getSectionOccupancy: jest
              .fn()
              .mockResolvedValue([{ seccion: 'A', disponibles: 2 }]),
          },
        },
        {
          provide: StudentChangeAuditService,
          useValue: {
            recordReadmission: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(StudentReadmissionService);
  });

  it('getContext expone institución, permisos y motivos', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.nombre).toBe('IE Demo');
    expect(ctx.permisoRegistrar).toBe('matricula.reingreso');
    expect(ctx.motivos.length).toBeGreaterThan(0);
  });

  it('getEligibility rechaza matrícula no retirada', async () => {
    studentRepo.findOneBy.mockResolvedValue({
      ...student,
      estadoMatricula: 'activo',
    });
    readmissionRepo.findOne.mockResolvedValue(null);
    withdrawalRepo.findOne.mockResolvedValue(withdrawal);

    const elig = await service.getEligibility(7);
    expect(elig.elegible).toBe(false);
    expect(elig.motivoInelegible).toContain('retirada');
  });

  it('getEligibility rechaza sin retiro previo', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    readmissionRepo.findOne.mockResolvedValue(null);
    withdrawalRepo.findOne.mockResolvedValue(null);

    const elig = await service.getEligibility(7);
    expect(elig.elegible).toBe(false);
    expect(elig.motivoInelegible).toContain('retiro previo');
  });

  it('register lanza 404 si el estudiante no existe', async () => {
    studentRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.register(99, {
        fechaReingreso: '2026-09-10',
        motivo: 'Retorno a la institución educativa',
        autorizacion: 'Resolución directoral N.° 001-2026',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('register impide duplicado del mismo año', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    readmissionRepo.findOne.mockResolvedValue({ id: 1 } as StudentReadmission);
    withdrawalRepo.findOne.mockResolvedValue(withdrawal);

    await expect(
      service.register(7, {
        fechaReingreso: '2026-09-10',
        motivo: 'Retorno a la institución educativa',
        autorizacion: 'Resolución directoral N.° 001-2026',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('register valida fecha anterior al retiro', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    readmissionRepo.findOne.mockResolvedValue(null);
    withdrawalRepo.findOne.mockResolvedValue(withdrawal);

    await expect(
      service.register(7, {
        fechaReingreso: '2026-06-01',
        motivo: 'Retorno a la institución educativa',
        autorizacion: 'Resolución directoral N.° 001-2026',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('register es idempotente con el mismo correlationId', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    readmissionRepo.findOne.mockResolvedValue({
      id: 44,
      studentId: 7,
      studentCodigo: 'EST007',
      studentNombre: 'Mendoza, Carlos',
      anioEscolar: 2026,
      withdrawalId: 5,
      nivel: 'Secundaria',
      grado: '3°',
      seccion: 'A',
      fechaReingreso: '2026-09-10',
      fechaRetiroVinculada: '2026-06-15',
      motivo: 'Retorno a la institución educativa',
      autorizacion: 'Resolución directoral N.° 001-2026',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: {},
      ip: '',
      correlationId: 'corr-1',
      notasConservadas: 4,
      asistenciasConservadas: 12,
      vacantesDisponiblesDespues: 1,
      createdAt: new Date('2026-09-10T12:00:00Z'),
    } as StudentReadmission);

    const result = await service.register(
      7,
      {
        fechaReingreso: '2026-09-10',
        motivo: 'Retorno a la institución educativa',
        autorizacion: 'Resolución directoral N.° 001-2026',
      },
      {
        headers: { 'idempotency-key': 'corr-1' },
      } as never,
    );

    expect(result.id).toBe(44);
    expect(result.duplicadoIdempotente).toBe(true);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('register persiste reingreso, conserva notas/asistencia y ocupa vacante', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    readmissionRepo.findOne.mockResolvedValue(null);
    withdrawalRepo.findOne.mockResolvedValue(withdrawal);

    const savedRow = {
      id: 10,
      studentId: 7,
      studentCodigo: 'EST007',
      studentNombre: 'Mendoza, Carlos',
      anioEscolar: 2026,
      withdrawalId: 5,
      nivel: 'Secundaria',
      grado: '3°',
      seccion: 'A',
      fechaReingreso: '2026-09-10',
      fechaRetiroVinculada: '2026-06-15',
      motivo: 'Retorno a la institución educativa',
      autorizacion: 'Resolución directoral N.° 001-2026',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: { estadoMatricula: { anterior: 'retirado', nuevo: 'activo' } },
      ip: '',
      correlationId: 'corr-2',
      notasConservadas: 4,
      asistenciasConservadas: 12,
      vacantesDisponiblesDespues: 1,
      createdAt: new Date('2026-09-10T12:00:00Z'),
    } as StudentReadmission;

    dataSource.transaction.mockImplementation(
      async (fn: (m: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Student) {
              return {
                findOne: jest.fn().mockResolvedValue({ ...student }),
                save: jest
                  .fn()
                  .mockImplementation((s: Student) => Promise.resolve(s)),
              };
            }
            if (entity === StudentAcademicHistory) {
              return {
                findOne: jest.fn().mockResolvedValue({
                  studentId: 7,
                  anio: '2026',
                  estado: 'Retirado',
                }),
                save: jest
                  .fn()
                  .mockImplementation((s: StudentAcademicHistory) =>
                    Promise.resolve(s),
                  ),
                create: (v: Partial<StudentAcademicHistory>) => v,
              };
            }
            if (entity === StudentReadmission) {
              return {
                findOne: jest.fn().mockResolvedValue(null),
                save: jest.fn().mockResolvedValue(savedRow),
                create: (v: Partial<StudentReadmission>) => v,
              };
            }
            return {};
          },
        };
        return fn(manager);
      },
    );

    const result = await service.register(7, {
      fechaReingreso: '2026-09-10',
      motivo: 'Retorno a la institución educativa',
      autorizacion: 'Resolución directoral N.° 001-2026',
    });

    expect(result.estado).toBe('registrado');
    expect(result.withdrawalId).toBe(5);
    expect(result.notasConservadas).toBe(4);
    expect(result.asistenciasConservadas).toBe(12);
    expect(result.cambios.estadoMatricula).toEqual({
      anterior: 'retirado',
      nuevo: 'activo',
    });
  });
});
