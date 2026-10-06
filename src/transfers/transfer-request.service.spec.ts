import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { Institution } from '../institution/entities/institution.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';

import { Student } from '../students/entities/student.entity';

import { TransferNotification } from './entities/transfer-notification.entity';

import { TransferRequestEvent } from './entities/transfer-request-event.entity';

import { TransferRequest } from './entities/transfer-request.entity';

import { TransferRequestService } from './transfer-request.service';

function studentDocumentsServiceMock() {
  return {
    assertDocumentoEvidenciaTraslado: jest.fn(async () => ({
      id: 1,
      tipo: 'Resolución de traslado',
      numero: 'RD-001',
    })),
    getEvidenciaTrasladoDetalle: jest.fn(async () => null),
  } as never;
}

function transferEnrollmentServiceMock() {
  return {
    assertListoParaConcluir: jest.fn(),
    registrarMatriculaDestino: jest.fn(async () => ({
      anterior: {
        institutionId: 1,
        seccion: 'A',
        estadoMatricula: 'retirado',
        activo: true,
      },
      nuevo: {
        studentId: 9,
        institutionId: 3,
        codigoModular: '7654321',
        seccion: 'B',
        grado: '3ro',
        nivel: 'Secundaria',
        estadoMatricula: 'activo',
        transferRequestId: 4,
      },
    })),
  } as never;
}

function transferVacancyServiceMock() {
  return {
    previewVacanteDestino: jest.fn(async () => ({
      vacanteDisponible: true,
      vacantesDisponibles: 5,
      vacantesEnSeccion: null,
      seccionAsignada: null,
      seccionSugerida: 'B',
      grado: '3ro',
      nivel: 'Secundaria',
      secciones: [
        { seccion: 'B', matriculados: 25, capacidad: 30, disponibles: 5, esIngresante: false },
      ],
    })),
    assertVacanteDestino: jest.fn(async () => ({
      vacanteDisponible: true,
      vacantesDisponibles: 5,
      vacantesEnSeccion: null,
      seccionAsignada: 'B',
      seccionSugerida: 'B',
      grado: '3ro',
      nivel: 'Secundaria',
      secciones: [
        { seccion: 'B', matriculados: 25, capacidad: 30, disponibles: 5, esIngresante: false },
      ],
    })),
  } as never;
}

function mockTransitionService(input: {

  request: Partial<TransferRequest>;

  vacancy?: ReturnType<typeof transferVacancyServiceMock>;

  institution?: {

    id: number;

    nombre: string;

    codigoModular: string;

    ugel: string;

    dre: string;

    anio: string;

    siglas: string;

  };

}) {

  const request = {

    id: 1,

    estado: 'enviada' as const,

    studentId: 9,

    studentDni: '12345678',

    anioEscolar: 2026,

    codigo: 'TR-2026-0001',

    motivo: 'Cambio de domicilio documentado',

    ieOrigenInstitutionId: 1,

    ieOrigenCodigoModular: '0654321',

    ieOrigenUgel: 'UGEL 01',

    ieOrigenDre: 'DRE Lima',

    ieOrigenNombre: 'IE Origen',

    ieDestinoCodigoModular: '7654321',

    ieDestinoInstitutionId: 3,

    ieDestinoNombre: 'IE Destino',

    plazoHasta: '2099-01-01',

    observacion: '',

    ...input.request,

  };

  const institution = {

    id: 1,

    nombre: 'IE Origen',

    codigoModular: '0654321',

    ugel: 'UGEL 01',

    dre: 'DRE Lima',

    anio: '2026',

    siglas: 'IEO',

    ...input.institution,

  };

  const originInstitution = {
    id: 1,
    nombre: 'IE Origen',
    codigoModular: '0654321',
    ugel: 'UGEL 01',
    dre: 'DRE Lima',
    anio: '2026',
    siglas: 'IEO',
  };

  const student = {
    id: 9,
    dni: '12345678',
    activo: true,
    estadoMatricula: 'activo',
    institutionId: 1,
    nombre: 'Juan',
    apellido: 'Perez',
    nivel: 'Secundaria',
    grado: '3ro',
    seccion: 'A',
  };

  const requests = {

    findOneBy: jest.fn().mockResolvedValue(request),

    findOne: jest.fn().mockResolvedValue(null),

    save: jest.fn(async (row: typeof request) => row),

  };

  const institutions = {
    findOneBy: jest.fn(async (where: { id?: number; codigoModular?: string }) => {
      if (where.id === originInstitution.id) return originInstitution;
      if (where.codigoModular === originInstitution.codigoModular) return originInstitution;
      return null;
    }),
  };

  const students = {
    findOneBy: jest.fn().mockResolvedValue(student),
  };

  const events = {

    create: jest.fn((row: object) => row),

    save: jest.fn(async (row: object) => ({ id: 1, createdAt: new Date(), ...row })),

    find: jest.fn().mockResolvedValue([]),

  };

  const notifications = {

    create: jest.fn((row: object) => row),

    save: jest.fn(async (row: object) => ({ id: 1, createdAt: new Date(), ...row })),

    find: jest.fn().mockResolvedValue([]),

  };

  const manager = {

    getRepository: (entity: { name: string }) => {

      if (entity === TransferRequest) return requests;

      if (entity === TransferRequestEvent) return events;

      if (entity === TransferNotification) return notifications;

      if (entity === Institution) return institutions;

      if (entity === Student) return students;

      throw new Error(`Repositorio no simulado: ${entity.name}`);

    },

  };

  const notificationService = {

    dispatchInTransaction: jest.fn(async () => []),

    toDto: jest.fn((n: object) => n),

  };

  const vacancy = input.vacancy ?? transferVacancyServiceMock();

  const service = new TransferRequestService(

    { transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)) } as never,

    {} as never,

    {} as never,

    {

      findOne: jest.fn().mockResolvedValue(institution),

      findOneBy: jest.fn().mockResolvedValue(institution),

    } as never,

    { find: jest.fn().mockResolvedValue([]) } as never,

    { log: jest.fn() } as never,

    notificationService as never,
    studentDocumentsServiceMock(),
    vacancy,
    transferEnrollmentServiceMock(),
  );

  return { service, request, institution, requests, vacancy };

}



describe('TransferRequestService', () => {

  it('impide que la IE de origen apruebe la solicitud', async () => {

    const { service } = mockTransitionService({ request: {} });

    await expect(

      service.transition(1, { accion: 'aprobar', motivo: 'Intento de aprobación desde origen' }, {

        req: { headers: {} } as never,

        permisos: ['traslados.solicitar'],

        ambitos: ['IE'],

        esAdmin: false,

        institutionId: 1,

      }),

    ).rejects.toBeInstanceOf(ForbiddenException);

  });



  it('impide resolver sin ámbito UGEL, DRE o MINEDU', async () => {

    const { service } = mockTransitionService({ request: {} });

    await expect(

      service.transition(1, { accion: 'observar', motivo: 'Falta constancia' }, {

        req: { headers: {} } as never,

        permisos: ['traslados.resolver'],

        ambitos: ['IE'],

        esAdmin: false,

        institutionId: 1,

      }),

    ).rejects.toBeInstanceOf(ForbiddenException);

  });



  it('rechaza aprobar si el DNI del estudiante no coincide con la solicitud', async () => {
    const { service, requests } = mockTransitionService({
      request: { estado: 'enviada', studentDni: '99999999' },
      institution: {
        id: 3,
        nombre: 'I.E. Francisco Bolognesi',
        codigoModular: '7654321',
        ugel: 'UGEL 04 Lima',
        dre: 'DRE Lima Metropolitana',
        anio: '2026',
        siglas: 'IEDE',
      },
    });

    await expect(
      service.transition(
        1,
        { accion: 'aprobar', motivo: 'Documentación conforme en destino' },
        {
          req: { headers: {} } as never,
          permisos: ['traslados.aprobar_destino', 'traslados.ver'],
          ambitos: ['IE'],
          esAdmin: false,
          institutionId: 3,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(requests.save).not.toHaveBeenCalled();
  });

  it('permite que la IE de destino apruebe una solicitud enviada', async () => {

    const { service, requests } = mockTransitionService({

      request: { estado: 'enviada' },

      institution: {

        id: 3,

        nombre: 'I.E. Francisco Bolognesi',

        codigoModular: '7654321',

        ugel: 'UGEL 04 Lima',

        dre: 'DRE Lima Metropolitana',

        anio: '2026',

        siglas: 'IEDE',

      },

    });



    const result = await service.transition(

      1,

      { accion: 'aprobar', motivo: 'Vacante disponible y documentación conforme' },

      {

        req: { headers: {} } as never,

        permisos: ['traslados.aprobar_destino', 'traslados.ver'],

        ambitos: ['IE'],

        esAdmin: false,

        institutionId: 3,

      },

    );



    expect(result.estado).toBe('aprobada');

    expect(requests.save).toHaveBeenCalledWith(expect.objectContaining({ estado: 'aprobada' }));

  });

  it('rechaza aprobar si no hay vacante en la IE destino', async () => {
    const vacancy = transferVacancyServiceMock();
    (vacancy.assertVacanteDestino as jest.Mock).mockRejectedValue(
      new BadRequestException('No hay vacantes disponibles en la IE de destino para 3ro Secundaria.'),
    );
    const { service, requests } = mockTransitionService({
      request: { estado: 'enviada', ieDestinoInstitutionId: 3 },
      vacancy,
      institution: {
        id: 3,
        nombre: 'I.E. Francisco Bolognesi',
        codigoModular: '7654321',
        ugel: 'UGEL 04 Lima',
        dre: 'DRE Lima Metropolitana',
        anio: '2026',
        siglas: 'IEDE',
      },
    });

    await expect(
      service.transition(
        1,
        { accion: 'aprobar', motivo: 'Intento sin vacante disponible' },
        {
          req: { headers: {} } as never,
          permisos: ['traslados.aprobar_destino', 'traslados.ver'],
          ambitos: ['IE'],
          esAdmin: false,
          institutionId: 3,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(requests.save).not.toHaveBeenCalled();
  });

  it('oculta el traslado a una IE que no es origen ni destino', async () => {
    const { service } = mockTransitionService({
      request: { estado: 'enviada' },
      institution: {
        id: 2,
        nombre: 'IE Santa Rosa',
        codigoModular: '2222222',
        ugel: 'UGEL 03',
        dre: 'DRE Lima',
        anio: '2026',
        siglas: 'IESR',
      },
    });

    await expect(
      service.transition(1, { accion: 'aprobar', motivo: 'Intento desde IE ajena al traslado' }, {
        req: { headers: {} } as never,
        permisos: ['traslados.aprobar_destino'],
        ambitos: ['IE'],
        esAdmin: false,
        institutionId: 2,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundException' });
  });

  it('impide aprobar en destino sin el permiso traslados.aprobar_destino', async () => {
    const { service } = mockTransitionService({
      request: { estado: 'enviada' },
      institution: {
        id: 3,
        nombre: 'I.E. Francisco Bolognesi',
        codigoModular: '7654321',
        ugel: 'UGEL 04 Lima',
        dre: 'DRE Lima Metropolitana',
        anio: '2026',
        siglas: 'IEDE',
      },
    });

    await expect(
      service.transition(1, { accion: 'aprobar', motivo: 'Intento sin permiso de aprobación' }, {
        req: { headers: {} } as never,
        permisos: ['traslados.ver'],
        ambitos: ['IE'],
        esAdmin: false,
        institutionId: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

});



describe('TransferRequestService concluir', () => {

  it('cierra matrícula en origen y activa al estudiante en la IE destino', async () => {

    const student = {

      id: 9,

      institutionId: 1,

      estadoMatricula: 'activo' as const,

      activo: true,

      dni: '12345678',

      grado: '3°',

      nivel: 'Secundaria',

      seccion: 'A',

      nombre: 'Ana',

      apellido: 'Perez',

    };

    const history = {

      id: 1,

      studentId: 9,

      anio: '2026',

      grado: '3°',

      seccion: 'A',

      promedio: 16,

      estado: 'Promovido',

    };

    const request = {

      id: 4,

      estado: 'aprobada' as const,

      studentId: 9,

      anioEscolar: 2026,

      codigo: 'TR-2026-0004',

      motivo: 'Cambio de domicilio documentado',

      ieOrigenCodigoModular: '1234567',

      ieOrigenUgel: 'UGEL 01',

      ieOrigenDre: 'DRE Lima',

      ieOrigenNombre: 'IE Origen',

      ieDestinoCodigoModular: '7654321',

      ieDestinoInstitutionId: 3,

      ieDestinoNombre: 'IE Destino',

      seccionDestino: 'B',

      plazoHasta: '2099-01-01',

      observacion: '',

    };

    const students = {

      findOne: jest.fn().mockResolvedValue(student),

      save: jest.fn(async (row: typeof student) => row),

    };

    const historyRepo = {

      findOne: jest.fn().mockResolvedValue(history),

      create: jest.fn((row: object) => row),

      save: jest.fn(async (row: typeof history) => row),

    };

    const requests = {

      findOneBy: jest.fn().mockResolvedValue(request),

      save: jest.fn(async (row: typeof request) => row),

    };

    const events = {

      create: jest.fn((row: object) => row),

      save: jest.fn(async (row: object) => ({ id: 1, createdAt: new Date(), ...row })),

      find: jest.fn().mockResolvedValue([]),

    };

    const notifications = {

      create: jest.fn((row: object) => row),

      save: jest.fn(async (row: object) => ({ id: 1, createdAt: new Date(), ...row })),

      find: jest.fn().mockResolvedValue([]),

    };

    const manager = {

      getRepository: (entity: { name: string }) => {

        if (entity === TransferRequest) return requests;

        if (entity === Student) return students;

        if (entity === StudentAcademicHistory) return historyRepo;

        if (entity === TransferRequestEvent) return events;

        if (entity === TransferNotification) return notifications;

        throw new Error(`Repositorio no simulado: ${entity.name}`);

      },

    };

    const enrollment = transferEnrollmentServiceMock();
    (enrollment.registrarMatriculaDestino as jest.Mock).mockImplementation(async () => {
      student.institutionId = 3;
      student.seccion = 'B';
      student.estadoMatricula = 'activo';
      return {
        anterior: { institutionId: 1, seccion: 'A', estadoMatricula: 'retirado', activo: true },
        nuevo: {
          studentId: 9,
          institutionId: 3,
          codigoModular: '7654321',
          seccion: 'B',
          grado: '3°',
          nivel: 'Secundaria',
          estadoMatricula: 'activo',
          transferRequestId: 4,
        },
      };
    });

    const concluir = new TransferRequestService(

      { transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)) } as never,

      {} as never,

      {} as never,

      {

        findOne: jest.fn().mockResolvedValue({

          id: 1,

          nombre: 'IE Origen',

          codigoModular: '1234567',

          ugel: 'UGEL 01',

          dre: 'DRE Lima',

          anio: '2026',

          siglas: 'IEO',

        }),

      } as never,

      { find: jest.fn().mockResolvedValue([]) } as never,

      { log: jest.fn() } as never,

      { dispatchInTransaction: jest.fn(async () => []), toDto: jest.fn((n: object) => n) } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      enrollment,
    );



    const result = await concluir.transition(

      4,

      { accion: 'concluir', motivo: 'Constancia de matrícula en la IE de destino' },

      {

        req: { headers: {} } as never,

        permisos: ['traslados.resolver'],

        ambitos: ['MINEDU'],

        esAdmin: true,

      },

    );



    expect(result.estado).toBe('concluida');

    expect(result.matriculaDestino).toEqual({
      studentId: 9,
      institutionId: 3,
      codigoModular: '7654321',
      seccion: 'B',
    });

    expect(student.institutionId).toBe(3);

    expect(student.seccion).toBe('B');

    expect(student.estadoMatricula).toBe('activo');

    expect(history.estado).toBe('Trasladado');

    expect(history.promedio).toBe(16);

    expect(historyRepo.save).toHaveBeenCalledTimes(1);

  });

});

describe('TransferRequestService registerMotivo', () => {
  it('registra motivo sin cambiar el estado y audita', async () => {
    const request = {
      id: 2,
      estado: 'enviada' as const,
      studentId: 9,
      codigo: 'TR-2026-0002',
      motivo: 'Motivo original de la solicitud',
      observacion: '',
      ieOrigenCodigoModular: '0654321',
      ieDestinoCodigoModular: '7654321',
      ieOrigenUgel: 'UGEL 01',
      ieOrigenDre: 'DRE Lima',
    };
    const requests = {
      findOneBy: jest.fn().mockResolvedValue(request),
      save: jest.fn(async (row: typeof request) => row),
    };
    const savedEvent = {
      id: 99,
      accion: 'registrar_motivo',
      motivo: 'Se requiere constancia de vacante actualizada',
      estadoAnterior: 'enviada',
      estadoNuevo: 'enviada',
      actorNombre: '',
      createdAt: new Date(),
    };
    const events = {
      find: jest.fn().mockResolvedValue([savedEvent]),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
      create: jest.fn((row: object) => row),
      save: jest.fn(async (row: object) => ({ ...savedEvent, ...row })),
    };
    const manager = {
      getRepository: (entity: { name: string }) => {
        if (entity === TransferRequest) return requests;
        if (entity === TransferRequestEvent) return events;
        if (entity === TransferNotification) {
          return { find: jest.fn().mockResolvedValue([]) };
        }
        throw new Error(`Repositorio no simulado: ${entity.name}`);
      },
    };
    const svc = new TransferRequestService(
      { transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)) } as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 3,
          codigoModular: '7654321',
          ugel: 'UGEL 04 Lima',
          dre: 'DRE Lima Metropolitana',
          anio: '2026',
          nombre: 'IE Destino',
          siglas: 'IED',
        }),
        findOneBy: jest.fn().mockResolvedValue({
          id: 3,
          codigoModular: '7654321',
          ugel: 'UGEL 04 Lima',
          dre: 'DRE Lima Metropolitana',
          anio: '2026',
          nombre: 'IE Destino',
          siglas: 'IED',
        }),
      } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { log: jest.fn() } as never,
      { dispatchInTransaction: jest.fn(async () => []), toDto: jest.fn((n: object) => n) } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    const result = await svc.registerMotivo(
      2,
      { motivo: 'Se requiere constancia de vacante actualizada', observacion: 'Pendiente documento' },
      {
        req: { headers: {} } as never,
        permisos: ['traslados.aprobar_destino'],
        ambitos: ['IE'],
        esAdmin: false,
        institutionId: 3,
      },
    );

    expect(result.estado).toBe('enviada');
    expect(result.observacion).toBe('Pendiente documento');
    expect(result.eventos.some((e: { accion: string }) => e.accion === 'registrar_motivo')).toBe(true);
    expect(events.save).toHaveBeenCalled();
  });

  it('rechaza usuario con solo permiso ver en IE origen', async () => {
    const request = {
      id: 2,
      estado: 'enviada' as const,
      ieOrigenCodigoModular: '0654321',
      ieDestinoCodigoModular: '7654321',
      ieOrigenUgel: 'UGEL 01',
      ieOrigenDre: 'DRE Lima',
    };
    const svc = new TransferRequestService(
      { transaction: jest.fn((fn: (m: object) => unknown) => fn({ getRepository: () => ({ findOneBy: jest.fn().mockResolvedValue(request) }) })) } as never,
      {} as never,
      {} as never,
      {
        findOneBy: jest.fn().mockResolvedValue({
          id: 1,
          codigoModular: '0654321',
          ugel: 'UGEL 01',
          dre: 'DRE Lima',
        }),
      } as never,
      { find: jest.fn() } as never,
      { log: jest.fn() } as never,
      { dispatchInTransaction: jest.fn(), toDto: jest.fn() } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    await expect(
      svc.registerMotivo(
        2,
        { motivo: 'Intento sin permiso de registro' },
        {
          req: { headers: {} } as never,
          permisos: ['traslados.ver'],
          ambitos: ['IE'],
          esAdmin: false,
          institutionId: 1,
        },
      ),
    ).rejects.toMatchObject({ name: 'ForbiddenException' });
  });

  it('rechaza motivo duplicado reciente', async () => {
    const request = {
      id: 2,
      estado: 'enviada' as const,
      studentId: 9,
      observacion: '',
      ieOrigenCodigoModular: '0654321',
      ieDestinoCodigoModular: '7654321',
    };
    const events = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 50 }),
      })),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === TransferRequest) {
          return { findOneBy: jest.fn().mockResolvedValue(request), save: jest.fn() };
        }
        if (entity === TransferRequestEvent) return events;
        if (entity === TransferNotification) return { find: jest.fn().mockResolvedValue([]) };
        throw new Error(`Repositorio no simulado: ${String(entity)}`);
      },
    };
    const svc = new TransferRequestService(
      { transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)) } as never,
      {} as never,
      {} as never,
      {
        findOneBy: jest.fn().mockResolvedValue({
          id: 3,
          codigoModular: '7654321',
          ugel: 'UGEL 04 Lima',
          dre: 'DRE Lima Metropolitana',
        }),
      } as never,
      { find: jest.fn() } as never,
      { log: jest.fn() } as never,
      { dispatchInTransaction: jest.fn(), toDto: jest.fn() } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    await expect(
      svc.registerMotivo(
        2,
        { motivo: 'Motivo repetido en ventana corta' },
        {
          req: { headers: {} } as never,
          permisos: ['traslados.aprobar_destino'],
          ambitos: ['IE'],
          esAdmin: false,
          institutionId: 3,
        },
      ),
    ).rejects.toMatchObject({ name: 'ConflictException' });
  });

  it('rechaza registro en solicitud concluida', async () => {
    const { service } = mockTransitionService({
      request: { estado: 'concluida' },
      institution: {
        id: 1,
        nombre: 'IE Origen',
        codigoModular: '0654321',
        ugel: 'UGEL 01',
        dre: 'DRE Lima',
        anio: '2026',
        siglas: 'IEO',
      },
    });

    await expect(
      service.registerMotivo(
        1,
        { motivo: 'Intento tardío de registro' },
        {
          req: { headers: {} } as never,
          permisos: ['traslados.solicitar'],
          ambitos: ['IE'],
          esAdmin: false,
          institutionId: 1,
        },
      ),
    ).rejects.toMatchObject({ name: 'BadRequestException' });
  });
});

describe('TransferRequestService getSeguimiento', () => {
  it('consolida etapas, línea de tiempo y auditoría', async () => {
    const request = {
      id: 5,
      codigo: 'TR-2026-0005',
      studentId: 9,
      studentCodigo: 'E001',
      studentNombre: 'Pérez, Juan',
      studentDni: '12345678',
      anioEscolar: 2026,
      estado: 'enviada' as const,
      ieOrigenNombre: 'IE Origen',
      ieOrigenCodigoModular: '0654321',
      ieOrigenUgel: 'UGEL 01',
      ieOrigenDre: 'DRE Lima',
      ieDestinoNombre: 'IE Destino',
      ieDestinoCodigoModular: '7654321',
      ieDestinoUgel: 'UGEL 02',
      ieDestinoDre: 'DRE Lima',
      plazoHasta: '2099-12-31',
      motivo: 'Cambio de domicilio',
      observacion: '',
      evidencia: 'Resolución 001',
      actorNombre: 'Secretaría',
      actorRol: 'SECRETARIA',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
    };
    const eventos = [
      {
        id: 1,
        transferRequestId: 5,
        accion: 'crear',
        estadoAnterior: null,
        estadoNuevo: 'borrador',
        motivo: 'Cambio de domicilio',
        observacion: '',
        actorNombre: 'Secretaría',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        id: 2,
        transferRequestId: 5,
        accion: 'enviar',
        estadoAnterior: 'borrador',
        estadoNuevo: 'enviada',
        motivo: 'Envío formal',
        observacion: '',
        actorNombre: 'Secretaría',
        createdAt: new Date('2026-01-02T10:00:00Z'),
      },
    ];
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === TransferRequestEvent) {
          return { find: jest.fn().mockResolvedValue(eventos) };
        }
        if (entity === TransferNotification) {
          return { find: jest.fn().mockResolvedValue([]) };
        }
        throw new Error(`Repositorio no simulado: ${String(entity)}`);
      },
    };
    const svc = new TransferRequestService(
      { manager } as never,
      { findOneBy: jest.fn().mockResolvedValue(request) } as never,
      {} as never,
      {
        findOneBy: jest.fn().mockResolvedValue({
          id: 1,
          codigoModular: '0654321',
          ugel: 'UGEL 01',
          dre: 'DRE Lima',
          anio: '2026',
          nombre: 'IE Origen',
          siglas: 'IEO',
        }),
        findOne: jest.fn().mockResolvedValue({
          nombre: 'IE Destino',
          codigoModular: '7654321',
          ugel: 'UGEL 02',
          dre: 'DRE Lima',
        }),
      } as never,
      {
        find: jest.fn().mockResolvedValue([
          {
            id: 10,
            accion: 'actualizar',
            descripcion: 'Envió solicitud TR-2026-0005',
            usuarioNombre: 'Secretaría',
            resultado: 'success',
            detalle: { estadoNuevo: 'enviada' },
            createdAt: new Date('2026-01-02T10:05:00Z'),
          },
        ]),
      } as never,
      { log: jest.fn() } as never,
      { toDto: jest.fn((n: object) => n) } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    const result = await svc.getSeguimiento(5, {
      req: { headers: {} } as never,
      permisos: ['traslados.ver', 'traslados.solicitar'],
      ambitos: ['IE'],
      esAdmin: false,
      institutionId: 1,
    });

    expect(result.solicitud.codigo).toBe('TR-2026-0005');
    expect(result.solicitud.rolVisualizador).toBe('origen');
    expect(result.etapas.some((e) => e.estado === 'en_curso')).toBe(true);
    expect(result.lineaTiempo.length).toBeGreaterThanOrEqual(3);
    expect(result.transparencia?.snapshot.ieOrigen.ugel).toBe('UGEL 01');
    expect(result.transparencia?.padronDestinoActual?.encontrada).toBe(true);
    expect(result.auditoria).toHaveLength(1);
    expect(result.resumen.estadoActual).toBe('enviada');
  });

  it('rechaza seguimiento fuera del ámbito', async () => {
    const request = {
      id: 6,
      codigo: 'TR-2026-0006',
      studentId: 9,
      studentCodigo: 'E001',
      studentNombre: 'Pérez, Juan',
      studentDni: '12345678',
      anioEscolar: 2026,
      estado: 'enviada' as const,
      ieOrigenNombre: 'IE Origen',
      ieOrigenCodigoModular: '0654321',
      ieOrigenUgel: 'UGEL 01',
      ieOrigenDre: 'DRE Lima',
      ieDestinoNombre: 'IE Destino',
      ieDestinoCodigoModular: '7654321',
      ieDestinoUgel: 'UGEL 02',
      ieDestinoDre: 'DRE Lima',
      plazoHasta: '2099-12-31',
      motivo: 'Motivo',
      observacion: '',
      evidencia: 'Evidencia',
      actorNombre: 'A',
      actorRol: 'SECRETARIA',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = new TransferRequestService(
      { manager: { getRepository: jest.fn() } } as never,
      { findOneBy: jest.fn().mockResolvedValue(request) } as never,
      {} as never,
      {
        findOneBy: jest.fn().mockResolvedValue({
          id: 99,
          codigoModular: '9999999',
          ugel: 'UGEL X',
          dre: 'DRE X',
          anio: '2026',
          nombre: 'Otra IE',
          siglas: 'OIE',
        }),
      } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { log: jest.fn() } as never,
      { toDto: jest.fn((n: object) => n) } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    await expect(
      svc.getSeguimiento(6, {
        req: { headers: {} } as never,
        permisos: ['traslados.ver'],
        ambitos: ['IE'],
        esAdmin: false,
        institutionId: 99,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundException' });
  });
});

describe('TransferRequestService alcance territorial', () => {
  it('getContext resuelve UGEL desde asignación sin IE de referencia', async () => {
    const svc = new TransferRequestService(
      {} as never,
      {} as never,
      {} as never,
      { findOneBy: jest.fn() } as never,
      { find: jest.fn() } as never,
      { log: jest.fn() } as never,
      { toDto: jest.fn() } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    const ctx = await svc.getContext({
      req: { headers: {} } as never,
      permisos: ['traslados.resolver'],
      ambitos: ['UGEL'],
      esAdmin: false,
      ugelCodigo: 'UGEL 01',
    });

    expect(ctx.institucion).toBeNull();
    expect(ctx.alcanceTerritorial).toMatchObject({
      nivel: 'UGEL',
      ugel: 'UGEL 01',
      fuente: 'asignacion',
    });
  });

  it('findAll exige UGEL de referencia si no hay asignación ni IE', async () => {
    const svc = new TransferRequestService(
      {} as never,
      {} as never,
      {} as never,
      { findOneBy: jest.fn() } as never,
      { find: jest.fn() } as never,
      { log: jest.fn() } as never,
      { toDto: jest.fn() } as never,
      studentDocumentsServiceMock(),
      transferVacancyServiceMock(),
      transferEnrollmentServiceMock(),
    );

    await expect(
      svc.findAll(
        {
          req: { headers: {} } as never,
          permisos: ['traslados.resolver'],
          ambitos: ['UGEL'],
          esAdmin: false,
        },
        {},
      ),
    ).rejects.toMatchObject({ name: 'BadRequestException' });
  });
});


