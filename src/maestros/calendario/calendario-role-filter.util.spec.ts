import { Evento } from '../../events/entities/evento.entity';
import {
  eventoVisibleParaRol,
  puedeGestionarCalendario,
  resolveCalendarioRolVista,
} from './calendario-role-filter.util';
import { RequestUser } from '../../auth/interfaces/request-user.interface';

function user(partial: Partial<RequestUser>): RequestUser {
  return {
    id: '1',
    username: 'test',
    roles: [],
    permisos: [],
    esAdmin: false,
    ...partial,
  };
}

describe('calendario-role-filter.util', () => {
  describe('resolveCalendarioRolVista', () => {
    it('identifica gestión IE para admin', () => {
      expect(resolveCalendarioRolVista(user({ esAdmin: true }))).toBe('gestion_ie');
    });

    it('identifica docente', () => {
      expect(resolveCalendarioRolVista(user({ roles: ['DOCENTE'] }))).toBe('docente');
    });

    it('identifica territorial para SIAGIE', () => {
      expect(
        resolveCalendarioRolVista(user({ roles: ['SIAGIE'], rolPrincipal: 'SIAGIE' })),
      ).toBe('territorial');
    });
  });

  describe('eventoVisibleParaRol', () => {
    const base: Pick<Evento, 'publicado' | 'cancelado' | 'destinatarios' | 'visibilidad' | 'nivel' | 'grado' | 'seccion'> = {
      publicado: true,
      cancelado: false,
      destinatarios: 'docentes',
      visibilidad: 'limitado',
      nivel: '',
      grado: '',
      seccion: '',
    };

    it('oculta borradores a roles de portal', () => {
      expect(eventoVisibleParaRol({ ...base, publicado: false }, 'docente')).toBe(
        false,
      );
    });

    it('gestión IE ve borradores', () => {
      expect(
        eventoVisibleParaRol({ ...base, publicado: false }, 'gestion_ie'),
      ).toBe(true);
    });

    it('alumno ve evento de su salón', () => {
      expect(
        eventoVisibleParaRol(
          {
            ...base,
            destinatarios: 'salon',
            visibilidad: 'limitado',
            nivel: 'Primaria',
            grado: '5°',
            seccion: 'A',
          },
          'alumno',
          { nivel: 'Primaria', grado: '5°', seccion: 'A' },
        ),
      ).toBe(true);
    });

    it('alumno no ve evento de otro salón', () => {
      expect(
        eventoVisibleParaRol(
          {
            ...base,
            destinatarios: 'salon',
            visibilidad: 'limitado',
            nivel: 'Primaria',
            grado: '5°',
            seccion: 'B',
          },
          'alumno',
          { nivel: 'Primaria', grado: '5°', seccion: 'A' },
        ),
      ).toBe(false);
    });

    it('docente ve eventos para docentes', () => {
      expect(eventoVisibleParaRol(base, 'docente')).toBe(true);
    });

    it('padre no ve eventos solo para docentes', () => {
      expect(eventoVisibleParaRol(base, 'padre')).toBe(false);
    });

    it('todos ven eventos globales', () => {
      expect(
        eventoVisibleParaRol(
          { ...base, visibilidad: 'global', destinatarios: 'todos' },
          'padre',
        ),
      ).toBe(true);
    });
  });

  describe('puedeGestionarCalendario', () => {
    it('permite gestionar con calendarizacion.gestionar', () => {
      expect(
        puedeGestionarCalendario(user({ permisos: ['calendarizacion.gestionar'] })),
      ).toBe(true);
    });

    it('deniega gestionar con solo calendarizacion.ver', () => {
      expect(
        puedeGestionarCalendario(user({ permisos: ['calendarizacion.ver'] })),
      ).toBe(false);
    });
  });
});
