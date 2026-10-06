import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  institutionIdDeAlcance,
  parseInstitutionId,
  resolveTenantScope,
  resolverInstitutionId,
} from './tenant-scope.util';
import { RequestUser } from './interfaces/request-user.interface';

const adminIe: RequestUser = {
  id: '2',
  username: 'admin',
  roles: ['ADMIN'],
  permisos: [],
  esAdmin: true,
  institutionId: 5,
};

const siagie: RequestUser = {
  id: '1',
  username: 'siagie',
  roles: ['SIAGIE'],
  permisos: [],
  esAdmin: true,
  rolPrincipal: 'SIAGIE',
  institutionId: null,
};

describe('parseInstitutionId', () => {
  it('parsea entero positivo desde string o number', () => {
    expect(parseInstitutionId('12')).toBe(12);
    expect(parseInstitutionId(3)).toBe(3);
  });

  it('rechaza valores inválidos', () => {
    expect(parseInstitutionId('')).toBeUndefined();
    expect(parseInstitutionId('abc')).toBeUndefined();
    expect(parseInstitutionId(0)).toBeUndefined();
    expect(parseInstitutionId(-1)).toBeUndefined();
  });
});

describe('institutionIdDeAlcance', () => {
  it('devuelve undefined para SIAGIE', () => {
    expect(institutionIdDeAlcance(siagie)).toBeUndefined();
  });

  it('devuelve institutionId del usuario IE', () => {
    expect(institutionIdDeAlcance(adminIe)).toBe(5);
  });

  it('SIAGIE lee institutionId del header del request', () => {
    expect(
      institutionIdDeAlcance(siagie, {
        headers: { 'x-institution-id': '12' },
      }),
    ).toBe(12);
  });

  it('SIAGIE lee institutionId del query del request', () => {
    expect(
      institutionIdDeAlcance(siagie, {
        query: { institutionId: '9' },
      }),
    ).toBe(9);
  });
});

describe('resolveTenantScope / resolverInstitutionId', () => {
  it('usuario IE usa su asignación e ignora header/query', () => {
    const scope = resolveTenantScope({
      user: adminIe,
      headerInstitutionId: '99',
      queryInstitutionId: '88',
    });
    expect(scope).toEqual({
      institutionId: 5,
      esSiagie: false,
      source: 'user-assignment',
    });
  });

  it('usuario IE sin institución lanza BadRequest', () => {
    const sinIe: RequestUser = { ...adminIe, institutionId: null };
    expect(() =>
      resolverInstitutionId({ user: sinIe }),
    ).toThrow(BadRequestException);
  });

  it('sin usuario lanza Unauthorized', () => {
    expect(() => resolverInstitutionId({ user: null })).toThrow(
      UnauthorizedException,
    );
  });

  it('SIAGIE sin contexto en modo required lanza BadRequest', () => {
    expect(() =>
      resolverInstitutionId({ user: siagie, mode: 'required' }),
    ).toThrow(BadRequestException);
  });

  it('SIAGIE sin contexto en modo optional devuelve undefined', () => {
    expect(
      resolverInstitutionId({ user: siagie, mode: 'optional' }),
    ).toBeUndefined();
  });

  it('SIAGIE prioriza header sobre query', () => {
    const scope = resolveTenantScope({
      user: siagie,
      headerInstitutionId: '7',
      queryInstitutionId: '8',
    });
    expect(scope).toEqual({
      institutionId: 7,
      esSiagie: true,
      source: 'header',
    });
  });

  it('SIAGIE acepta institutionId por query', () => {
    expect(
      resolverInstitutionId({
        user: siagie,
        queryInstitutionId: '4',
      }),
    ).toBe(4);
  });
});
