import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContinuityEnrollment } from '../continuity-enrollment/entities/continuity-enrollment.entity';
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { EnrollmentFeedback } from '../enrollment-feedback/entities/enrollment-feedback.entity';
import { TransferRequestEvent } from '../transfers/entities/transfer-request-event.entity';
import { TransferRequest } from '../transfers/entities/transfer-request.entity';
import { Institution } from '../institution/entities/institution.entity';
import { SectionChange } from '../students/entities/section-change.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { StudentReadmission } from '../students/entities/student-readmission.entity';
import { StudentWithdrawal } from '../students/entities/student-withdrawal.entity';
import { Student } from '../students/entities/student.entity';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { StudentsService } from '../students/students.service';
import { EnrollmentHistoryService } from './enrollment-history.service';

describe('EnrollmentHistoryService', () => {
  let service: EnrollmentHistoryService;
  let studentRepo: jest.Mocked<Repository<Student>>;
  let historyRepo: { find: jest.Mock };

  beforeEach(async () => {
    historyRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 10,
          anio: '2026',
          grado: '3°',
          seccion: 'A',
          promedio: 15,
          estado: 'Matriculado',
        },
      ]),
    };

    const emptyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    studentRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 1,
        codigo: 'E001',
        nombre: 'Ana',
        apellido: 'Perez',
        dni: '71234567',
        nivel: 'Primaria',
        grado: '3°',
        seccion: 'A',
        anioIngreso: '2024',
        estadoMatricula: 'activo',
        activo: true,
      } as Student),
    } as unknown as jest.Mocked<Repository<Student>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentHistoryService,
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
        {
          provide: StudentsService,
          useValue: {
            findHistorialAcademicoPage: jest.fn().mockResolvedValue({
              items: [],
              total: 0,
              page: 1,
              pageSize: 20,
            }),
            findHistorialAcademicoDetalle: jest.fn().mockResolvedValue({
              asistenciaPct: 95,
              trayectoria: [],
              resumenNotas: {
                promedioGeneral: 15,
                totalRegistros: 10,
                porBimestre: [],
              },
            }),
          },
        },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: getRepositoryToken(StudentAcademicHistory), useValue: historyRepo },
        { provide: getRepositoryToken(StudentWithdrawal), useValue: emptyRepo },
        { provide: getRepositoryToken(StudentReadmission), useValue: emptyRepo },
        { provide: getRepositoryToken(SectionChange), useValue: emptyRepo },
        { provide: getRepositoryToken(ContinuityEnrollment), useValue: emptyRepo },
        { provide: getRepositoryToken(EnrollmentEvaluation), useValue: emptyRepo },
        { provide: getRepositoryToken(EnrollmentFeedback), useValue: emptyRepo },
        {
          provide: getRepositoryToken(TransferRequest),
          useValue: {
            find: jest.fn().mockResolvedValue([
              {
                id: 7,
                codigo: 'TR-2026-0007',
                studentId: 1,
                anioEscolar: 2026,
                estado: 'enviada',
                ieOrigenNombre: 'IE Origen',
                ieDestinoNombre: 'IE Destino',
                ieOrigenCodigoModular: '0654321',
                ieDestinoCodigoModular: '7654321',
                ieOrigenUgel: 'UGEL 01',
                ieOrigenDre: 'DRE Lima',
                actorNombre: 'Sec',
                actorRol: 'SECRETARIA',
                createdAt: new Date('2026-02-01'),
              },
            ]),
          },
        },
        {
          provide: getRepositoryToken(TransferRequestEvent),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([
                {
                  id: 3,
                  transferRequestId: 7,
                  accion: 'enviar',
                  estadoAnterior: 'borrador',
                  estadoNuevo: 'enviada',
                  motivo: 'Documentación completa',
                  observacion: '',
                  actorNombre: 'Sec',
                  actorRol: 'SECRETARIA',
                  createdAt: new Date('2026-02-02'),
                },
              ]),
            }),
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
            }),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EnrollmentHistoryService);
  });

  it('expone contexto institucional', async () => {
    const ctx = await service.getContext();
    expect(ctx.institucion.anioEscolar).toBe(2026);
    expect(ctx.tiposEvento.some((t) => t.codigo === 'retiro')).toBe(true);
  });

  it('consolida eventos de matrícula por año', async () => {
    const detalle = await service.findOne(1);
    expect(detalle.estudiante.nombres).toBe('Ana');
    expect(detalle.eventosMatricula.some((e) => e.tipo === 'matricula')).toBe(true);
    expect(detalle.resumen.eventosTotal).toBeGreaterThan(0);
  });

  it('incluye traslados con transiciones en el historial', async () => {
    const detalle = await service.findOne(1, {
      req: { headers: {} } as never,
      permisos: ['matricula.ver'],
      ambitos: ['MINEDU'],
      esAdmin: true,
    });
    const traslados = detalle.eventosMatricula.filter((e) => e.tipo === 'traslado');
    expect(traslados.length).toBeGreaterThanOrEqual(2);
    expect(traslados.some((e) => e.metadata?.accion === 'enviar')).toBe(true);
    expect(traslados.some((e) => e.metadata?.transferRequestId === 7)).toBe(true);
  });

  it('lanza not found si estudiante no existe', async () => {
    studentRepo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
