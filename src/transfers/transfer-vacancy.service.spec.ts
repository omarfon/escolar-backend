import { BadRequestException } from '@nestjs/common';
import { TransferVacancyService } from './transfer-vacancy.service';
import type { TransferRequest } from './entities/transfer-request.entity';
import type { Student } from '../students/entities/student.entity';

describe('TransferVacancyService', () => {
  const row = {
    ieDestinoInstitutionId: 3,
    ieDestinoCodigoModular: '7654321',
    anioEscolar: 2026,
  } as TransferRequest;

  const student = {
    nivel: 'Secundaria',
    grado: '3ro',
    seccion: 'A',
  } as Student;

  const secciones = [
    { seccion: 'A', matriculados: 28, capacidad: 30, disponibles: 2, esIngresante: false },
    { seccion: 'B', matriculados: 30, capacidad: 30, disponibles: 0, esIngresante: false },
  ];

  function buildService(occupancy = secciones) {
    const salonesService = {
      getSectionOccupancyForInstitution: jest.fn(async () => occupancy),
    };
    const institutionRepo = {
      findOneBy: jest.fn(),
    };
    return {
      service: new TransferVacancyService(salonesService as never, institutionRepo as never),
      salonesService,
    };
  }

  it('rechaza aprobar sin vacantes en destino', async () => {
    const { service } = buildService([
      { seccion: 'A', matriculados: 30, capacidad: 30, disponibles: 0, esIngresante: false },
    ]);
    await expect(service.assertVacanteDestino(row, student)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('asigna sección única con cupo automáticamente', async () => {
    const { service } = buildService([
      { seccion: 'A', matriculados: 30, capacidad: 30, disponibles: 0, esIngresante: false },
      { seccion: 'B', matriculados: 25, capacidad: 30, disponibles: 5, esIngresante: false },
    ]);
    const result = await service.assertVacanteDestino(row, student);
    expect(result.seccionAsignada).toBe('B');
    expect(result.vacantesDisponibles).toBe(5);
  });

  it('exige sección cuando hay más de una con vacantes', async () => {
    const { service } = buildService([
      { seccion: 'A', matriculados: 28, capacidad: 30, disponibles: 2, esIngresante: false },
      { seccion: 'B', matriculados: 27, capacidad: 30, disponibles: 3, esIngresante: false },
    ]);
    await expect(service.assertVacanteDestino(row, student)).rejects.toThrow(
      'Indique la sección de destino',
    );
  });

  it('valida sección indicada con cupo', async () => {
    const { service } = buildService();
    const result = await service.assertVacanteDestino(row, student, 'A');
    expect(result.seccionAsignada).toBe('A');
    expect(result.vacantesEnSeccion).toBe(2);
  });
});
