import { esSuperusuarioSiagie } from '../../auth/tenant-scope.util';
import { resolveMaestrosInstitutionId } from '../common/maestros-tenant.util';

describe('docentes multitenant', () => {
  const siagieUser = {
    id: 1,
    rolPrincipal: 'SIAGIE' as const,
    roles: ['SIAGIE'],
    institutionId: undefined,
  };

  const ieUser = {
    id: 2,
    rolPrincipal: 'ADMIN' as const,
    roles: ['ADMIN'],
    institutionId: 5,
  };

  it('SIAGIE sin IE devuelve alcance global (undefined)', () => {
    expect(
      resolveMaestrosInstitutionId({ user: siagieUser, query: {}, headers: {} }),
    ).toBeUndefined();
    expect(esSuperusuarioSiagie(siagieUser)).toBe(true);
  });

  it('SIAGIE con header X-Institution-Id acota a esa IE', () => {
    expect(
      resolveMaestrosInstitutionId({
        user: siagieUser,
        query: {},
        headers: { 'x-institution-id': '3' },
      }),
    ).toBe(3);
  });

  it('usuario IE siempre usa su institutionId asignada', () => {
    expect(
      resolveMaestrosInstitutionId({
        user: ieUser,
        query: { institutionId: '99' },
        headers: { 'x-institution-id': '99' },
      }),
    ).toBe(5);
  });
});
