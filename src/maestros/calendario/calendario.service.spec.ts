import { ForbiddenException } from '@nestjs/common';
import { CalendarioEscolarService } from './calendario.service';
import { RequestUser } from '../../auth/interfaces/request-user.interface';

function user(partial: Partial<RequestUser>): RequestUser {
  return {
    id: '1',
    username: 'docente',
    roles: ['DOCENTE'],
    permisos: ['horarios.ver'],
    esAdmin: false,
    institutionId: 1,
    ...partial,
  };
}

describe('CalendarioEscolarService', () => {
  const institution = {
    id: 1,
    nombre: 'IE Demo',
    siglas: 'IED',
    anio: '2026',
    ugel: 'UGEL 02',
    dre: 'DRE Lima',
  };

  const anioRow = {
    id: 10,
    institutionId: 1,
    anio: 2026,
    fechaInicio: '2026-03-01',
    fechaFin: '2026-12-20',
    tipoPeriodo: 'bimestre',
    estado: 'activo',
    publicado: true,
    version: 1,
    vigente: true,
    activo: true,
  };

  function buildService(overrides: {
    eventos?: Array<Record<string, unknown>>;
    anio?: typeof anioRow;
  } = {}) {
    const eventos = overrides.eventos ?? [
      {
        id: 1,
        titulo: 'Capacitación docente',
        tipo: 'reunion',
        fechaInicio: '2026-06-10',
        fechaFin: '2026-06-10',
        horario: '15:00 – 17:00',
        destinatarios: 'docentes',
        visibilidad: 'limitado',
        nivel: '',
        grado: '',
        seccion: '',
        publicado: true,
        cancelado: false,
        estado: 'programado',
      },
      {
        id: 2,
        titulo: 'Reunión padres',
        tipo: 'reunion',
        fechaInicio: '2026-06-25',
        fechaFin: '2026-06-25',
        horario: '18:00 – 20:00',
        destinatarios: 'padres',
        visibilidad: 'limitado',
        nivel: '',
        grado: '',
        seccion: '',
        publicado: true,
        cancelado: false,
        estado: 'programado',
      },
    ];

    return new CalendarioEscolarService(
      { findOneBy: jest.fn(async () => institution) } as never,
      {
        findOne: jest.fn(async (opts) => {
          if (opts?.where?.vigente) return overrides.anio ?? anioRow;
          return overrides.anio ?? anioRow;
        }),
      } as never,
      { findOneBy: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {
        findAll: jest.fn(async () => []),
        calcularDiasClase: jest.fn(async () => ({
          diasLaborables: 20,
          diasClase: 18,
        })),
      } as never,
      { findAll: jest.fn(async () => eventos) } as never,
      { findAll: jest.fn(async () => []) } as never,
      { log: jest.fn() } as never,
    );
  }

  function reqFor(u: RequestUser) {
    return { user: u, headers: {}, ip: '127.0.0.1' } as never;
  }

  it('filtra eventos según rol docente', async () => {
    const service = buildService();
    const req = reqFor(user({ roles: ['DOCENTE'] }));

    const res = await service.getVisualizacion(req, { mes: '2026-06' });

    expect(res.contexto.rolVista).toBe('docente');
    expect(res.eventos.map((e) => e.titulo)).toEqual(['Capacitación docente']);
  });

  it('padre no ve eventos solo para docentes', async () => {
    const service = buildService();
    const req = reqFor(user({ roles: ['PADRE'], username: 'padre' }));

    const res = await service.getVisualizacion(req, { mes: '2026-06' });

    expect(res.contexto.rolVista).toBe('padre');
    expect(res.eventos.map((e) => e.titulo)).toEqual(['Reunión padres']);
  });

  it('bloquea año planificado cuando el portal lo solicita explícitamente', async () => {
    const service = buildService({
      anio: { ...anioRow, estado: 'planificado', publicado: false, vigente: false },
    });
    const req = reqFor(user({ roles: ['DOCENTE'] }));

    await expect(
      service.getVisualizacion(req, { mes: '2026-06', anioEscolar: 2027 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
