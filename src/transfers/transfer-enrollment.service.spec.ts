import { BadRequestException, ConflictException } from '@nestjs/common';
import { Institution } from '../institution/entities/institution.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Student } from '../students/entities/student.entity';
import { TransferEnrollmentService } from './transfer-enrollment.service';
import type { TransferRequest } from './entities/transfer-request.entity';

describe('TransferEnrollmentService', () => {
  const row = {
    id: 10,
    studentId: 9,
    anioEscolar: 2026,
    seccionDestino: 'B',
    ieDestinoInstitutionId: 3,
    ieDestinoCodigoModular: '7654321',
  } as TransferRequest;

  const student = {
    id: 9,
    dni: '12345678',
    grado: '3ro',
    nivel: 'Secundaria',
    seccion: 'A',
    institutionId: 1,
    estadoMatricula: 'retirado',
    activo: true,
  } as Student;

  function buildService() {
    const transferVacancy = {
      assertVacanteDestino: jest.fn(async () => ({
        seccionAsignada: 'B',
        vacantesDisponibles: 2,
      })),
    };
    const service = new TransferEnrollmentService(transferVacancy as never);
    return { service, transferVacancy };
  }

  it('rechaza concluir sin sección destino', () => {
    const { service } = buildService();
    expect(() =>
      service.assertListoParaConcluir({ ...row, seccionDestino: null } as TransferRequest),
    ).toThrow(BadRequestException);
  });

  it('registra matrícula activa en la IE destino', async () => {
    const { service } = buildService();
    const savedStudent = { ...student };
    const students = {
      findOne: jest.fn(async () => savedStudent),
      save: jest.fn(async (s: Student) => s),
    };
    const historyRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((payload: object) => payload),
      save: jest.fn(async (payload: object) => payload),
    };
    const institutions = {
      findOneBy: jest.fn(),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Student) return students;
        if (entity === StudentAcademicHistory) return historyRepo;
        if (entity === Institution) return institutions;
        throw new Error(String(entity));
      },
    };

    const result = await service.registrarMatriculaDestino(manager as never, row);

    expect(result.nuevo.institutionId).toBe(3);
    expect(result.nuevo.seccion).toBe('B');
    expect(result.nuevo.estadoMatricula).toBe('activo');
    expect(savedStudent.institutionId).toBe(3);
    expect(savedStudent.estadoMatricula).toBe('activo');
    expect(historyRepo.save).toHaveBeenCalled();
  });

  it('rechaza DNI activo duplicado en destino', async () => {
    const { service } = buildService();
    const students = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce({ id: 99, dni: '12345678' }),
      save: jest.fn(),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Student) return students;
        if (entity === StudentAcademicHistory) {
          return { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
        }
        if (entity === Institution) return { findOneBy: jest.fn() };
        throw new Error(String(entity));
      },
    };

    await expect(service.registrarMatriculaDestino(manager as never, row)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
