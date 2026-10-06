import { nivelAlcanceReporte } from './evaluation-reports-scope.util';
import type { RequestUser } from '../auth/interfaces/request-user.interface';

describe('evaluation-reports-scope.util', () => {
  const base: RequestUser = {
    id: '1',
    username: 'u',
    roles: [],
    permisos: [],
    esAdmin: false,
  };

  it('prioriza MINEDU sobre DRE/UGEL', () => {
    expect(
      nivelAlcanceReporte({
        ...base,
        roles: ['DRE'],
        ambitos: ['MINEDU', 'DRE'],
      }),
    ).toBe('MINEDU');
  });

  it('detecta ámbito UGEL', () => {
    expect(
      nivelAlcanceReporte({ ...base, roles: ['UGEL'], ambitos: ['UGEL'] }),
    ).toBe('UGEL');
  });

  it('default IE para docente', () => {
    expect(nivelAlcanceReporte({ ...base, roles: ['DOCENTE'] })).toBe('IE');
  });
});
