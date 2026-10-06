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
import { Student } from './entities/student.entity';
import { StudentWithdrawal } from './entities/student-withdrawal.entity';
import { StudentChangeAuditService } from './student-change-audit.service';
import { StudentWithdrawalService } from './student-withdrawal.service';

describe('StudentWithdrawalService', () => {
  let service: StudentWithdrawalService;
  let studentRepo: jest.Mocked<Repository<Student>>;
  let withdrawalRepo: jest.Mocked<Repository<StudentWithdrawal>>;
  let dataSource: { transaction: jest.Mock };

  const student = {
    id: 7,
    codigo: 'EST007',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    activo: true,
    estadoMatricula: 'activo',
    nivel: 'Secundaria',
    grado: '3°',
    seccion: 'A',
    anioIngreso: '2026',
  } as Student;

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

    withdrawalRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<StudentWithdrawal>>;

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentWithdrawalService,
        { provide: DataSource, useValue: dataSource },
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
              .mockResolvedValue([{ seccion: 'A', disponibles: 3 }]),
          },
        },
        {
          provide: StudentChangeAuditService,
          useValue: {
            recordWithdrawal: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuditLoggerService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(StudentWithdrawalService);
  });

  it('getContext expone institución, permisos y motivos', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.nombre).toBe('IE Demo');
    expect(ctx.permisoRegistrar).toBe('matricula.retiro');
    expect(ctx.motivos.length).toBeGreaterThan(0);
  });

  it('getEligibility rechaza matrícula no activa', async () => {
    studentRepo.findOneBy.mockResolvedValue({
      ...student,
      estadoMatricula: 'retirado',
    });
    withdrawalRepo.findOne.mockResolvedValue(null);

    const elig = await service.getEligibility(7);
    expect(elig.elegible).toBe(false);
    expect(elig.motivoInelegible).toContain('matrícula activa');
  });

  it('register lanza 404 si el estudiante no existe', async () => {
    studentRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.register(99, {
        fechaRetiro: '2026-09-10',
        motivo: 'Decisión familiar',
        sustento: 'Sustento suficiente para el trámite',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('register impide duplicado del mismo año', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    withdrawalRepo.findOne.mockResolvedValue({ id: 1 } as StudentWithdrawal);

    await expect(
      service.register(7, {
        fechaRetiro: '2026-09-10',
        motivo: 'Decisión familiar',
        sustento: 'Sustento suficiente para el trámite',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('register valida fecha fuera de ventana', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    withdrawalRepo.findOne.mockResolvedValue(null);

    await expect(
      service.register(7, {
        fechaRetiro: '2025-01-01',
        motivo: 'Decisión familiar',
        sustento: 'Sustento suficiente para el trámite',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('register es idempotente con el mismo correlationId', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    withdrawalRepo.findOne.mockResolvedValue({
      id: 44,
      studentId: 7,
      studentCodigo: 'EST007',
      studentNombre: 'Mendoza, Carlos',
      anioEscolar: 2026,
      nivel: 'Secundaria',
      grado: '3°',
      seccion: 'A',
      fechaRetiro: '2026-09-10',
      motivo: 'Decisión familiar',
      sustento: 'Sustento suficiente para el trámite',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: {},
      ip: '',
      correlationId: 'corr-1',
      notasConservadas: 4,
      asistenciasConservadas: 12,
      vacantesDisponiblesDespues: 3,
      createdAt: new Date('2026-09-10T12:00:00Z'),
    } as StudentWithdrawal);

    const result = await service.register(
      7,
      {
        fechaRetiro: '2026-09-10',
        motivo: 'Decisión familiar',
        sustento: 'Sustento suficiente para el trámite',
      },
      {
        headers: { 'idempotency-key': 'corr-1' },
      } as never,
    );

    expect(result.id).toBe(44);
    expect(result.duplicadoIdempotente).toBe(true);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('register persiste retiro, conserva notas/asistencia y libera vacante', async () => {
    studentRepo.findOneBy.mockResolvedValue(student);
    withdrawalRepo.findOne.mockResolvedValue(null);

    const savedRow = {
      id: 10,
      studentId: 7,
      studentCodigo: 'EST007',
      studentNombre: 'Mendoza, Carlos',
      anioEscolar: 2026,
      nivel: 'Secundaria',
      grado: '3°',
      seccion: 'A',
      fechaRetiro: '2026-09-10',
      motivo: 'Decisión familiar',
      sustento: 'Sustento suficiente para el trámite de retiro',
      estado: 'registrado',
      actorUserId: 1,
      actorNombre: 'Admin',
      actorRol: 'ADMIN',
      cambios: { estadoMatricula: { anterior: 'activo', nuevo: 'retirado' } },
      ip: '',
      correlationId: 'corr-2',
      notasConservadas: 4,
      asistenciasConservadas: 12,
      vacantesDisponiblesDespues: 3,
      createdAt: new Date('2026-09-10T12:00:00Z'),
    } as StudentWithdrawal;

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
                findOne: jest.fn().mockResolvedValue(null),
                save: jest
                  .fn()
                  .mockImplementation((s: StudentAcademicHistory) =>
                    Promise.resolve(s),
                  ),
                create: (v: Partial<StudentAcademicHistory>) => v,
              };
            }
            if (entity === StudentWithdrawal) {
              return {
                findOne: jest.fn().mockResolvedValue(null),
                save: jest.fn().mockResolvedValue(savedRow),
                create: (v: Partial<StudentWithdrawal>) => v,
              };
            }
            return {};
          },
        };
        return fn(manager);
      },
    );

    const result = await service.register(7, {
      fechaRetiro: '2026-09-10',
      motivo: 'Decisión familiar',
      sustento: 'Sustento suficiente para el trámite de retiro',
    });

    expect(result.estado).toBe('registrado');
    expect(result.notasConservadas).toBe(4);
    expect(result.asistenciasConservadas).toBe(12);
    expect(result.vacantesDisponiblesDespues).toBe(3);
    expect(result.cambios.estadoMatricula).toEqual({
      anterior: 'activo',
      nuevo: 'retirado',
    });
  });
});
