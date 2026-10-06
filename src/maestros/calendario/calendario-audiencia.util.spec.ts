import { resolveCalendarioAudiencia } from './calendario-audiencia.util';
import { RequestUser } from '../../auth/interfaces/request-user.interface';

function user(partial: Partial<RequestUser>): RequestUser {
  return {
    id: '1',
    username: 'estudiante',
    roles: ['ESTUDIANTE'],
    permisos: [],
    esAdmin: false,
    ...partial,
  };
}

describe('resolveCalendarioAudiencia', () => {
  it('resuelve nivel/grado/sección del alumno por email del usuario', async () => {
    const studentRepo = {
      findOneBy: jest.fn(async () => ({
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
      })),
    };
    const userRepo = {
      findOne: jest.fn(async () => ({ email: 'estudiante@escolar.pe' })),
    };

    const audiencia = await resolveCalendarioAudiencia(
      studentRepo as never,
      userRepo as never,
      user({ username: 'estudiante' }),
      'alumno',
    );

    expect(audiencia).toEqual({ nivel: 'Primaria', grado: '5°', seccion: 'A' });
  });

  it('no resuelve audiencia para docente', async () => {
    const studentRepo = { findOneBy: jest.fn() };
    const userRepo = { findOne: jest.fn() };

    const audiencia = await resolveCalendarioAudiencia(
      studentRepo as never,
      userRepo as never,
      user({ roles: ['DOCENTE'], username: 'docente' }),
      'docente',
    );

    expect(audiencia).toBeUndefined();
    expect(studentRepo.findOneBy).not.toHaveBeenCalled();
  });
});
