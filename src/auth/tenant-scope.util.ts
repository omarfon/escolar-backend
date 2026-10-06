import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestUser } from './interfaces/request-user.interface';

/** Header HTTP que el frontend SIAGIE enviará para acotar operaciones a una IE. */
export const TENANT_INSTITUTION_HEADER = 'x-institution-id';

export type TenantScopeMode = 'required' | 'optional';

export type TenantScopeSource =
  | 'user-assignment'
  | 'header'
  | 'query'
  | 'siagie-global';

export interface TenantScopeOptions {
  /** required: SIAGIE debe indicar IE. optional: SIAGIE puede ver todo (directorio, listados globales). */
  mode?: TenantScopeMode;
}

export interface ResolvedTenantScope {
  institutionId: number | undefined;
  esSiagie: boolean;
  source: TenantScopeSource;
}

export interface ResolverInstitutionIdInput {
  user?: RequestUser | null;
  queryInstitutionId?: string | number | null | undefined;
  headerInstitutionId?: string | number | null | undefined;
  mode?: TenantScopeMode;
}

export function esSuperusuarioSiagie(
  user?: Pick<RequestUser, 'roles' | 'rolPrincipal'> | null,
): boolean {
  if (!user) return false;
  return user.rolPrincipal === 'SIAGIE' || (user.roles ?? []).includes('SIAGIE');
}

export type InstitutionScopeRequest = TenantRequest;

/**
 * Undefined: vista global (SIAGIE sin IE seleccionada).
 * Un número acota operaciones a esa institución.
 * SIAGIE: lee header/query del request cuando se proporciona.
 */
export function institutionIdDeAlcance(
  user?: RequestUser | null,
  req?: InstitutionScopeRequest | null,
): number | undefined {
  if (user && esSuperusuarioSiagie(user)) {
    if (req) {
      const headerRaw =
        req.headers?.[TENANT_INSTITUTION_HEADER] ?? req.headers?.['X-Institution-Id'];
      const headerInstitutionId = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
      const fromHeader = parseInstitutionId(headerInstitutionId);
      if (fromHeader != null) return fromHeader;

      const queryRaw = req.query?.institutionId;
      const queryInstitutionId = Array.isArray(queryRaw)
        ? queryRaw[0]
        : (queryRaw as string | number | undefined);
      const fromQuery = parseInstitutionId(queryInstitutionId);
      if (fromQuery != null) return fromQuery;
    }
    return undefined;
  }
  if (!user) return undefined;
  return user.institutionId ?? -1;
}

export function parseInstitutionId(
  raw?: string | number | null,
): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

/**
 * Resuelve la IE activa para operaciones multitenant.
 * - Usuario IE: siempre su asignación (ignora header/query externos).
 * - SIAGIE + optional: undefined si no hay contexto (vistas globales).
 * - SIAGIE + required: exige header o query institutionId.
 */
export function resolveTenantScope(
  input: ResolverInstitutionIdInput,
): ResolvedTenantScope {
  const { user, queryInstitutionId, headerInstitutionId, mode = 'required' } = input;

  if (!user) {
    throw new UnauthorizedException('Usuario no autenticado');
  }

  const esSiagie = esSuperusuarioSiagie(user);

  if (!esSiagie) {
    const assigned = user.institutionId ?? undefined;
    if (assigned == null || assigned < 1) {
      throw new BadRequestException('El usuario no tiene una institución asignada');
    }
    return {
      institutionId: assigned,
      esSiagie: false,
      source: 'user-assignment',
    };
  }

  const fromHeader = parseInstitutionId(headerInstitutionId);
  if (fromHeader != null) {
    return { institutionId: fromHeader, esSiagie: true, source: 'header' };
  }

  const fromQuery = parseInstitutionId(queryInstitutionId);
  if (fromQuery != null) {
    return { institutionId: fromQuery, esSiagie: true, source: 'query' };
  }

  if (mode === 'optional') {
    return { institutionId: undefined, esSiagie: true, source: 'siagie-global' };
  }

  throw new BadRequestException(
    'Seleccione una institución educativa (header X-Institution-Id o query institutionId)',
  );
}

/** Atajo cuando solo se necesita el id numérico (o undefined en modo optional). */
export function resolverInstitutionId(input: ResolverInstitutionIdInput): number | undefined {
  return resolveTenantScope(input).institutionId;
}

export type TenantRequest = {
  user?: RequestUser;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
};

export function resolveTenantScopeFromRequest(
  req: TenantRequest,
  options: TenantScopeOptions = {},
): ResolvedTenantScope {
  const headerRaw =
    req.headers?.[TENANT_INSTITUTION_HEADER] ??
    req.headers?.['X-Institution-Id'];

  const headerInstitutionId = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const queryRaw = req.query?.institutionId;
  const queryInstitutionId = Array.isArray(queryRaw)
    ? queryRaw[0]
    : (queryRaw as string | number | undefined);

  return resolveTenantScope({
    user: req.user,
    headerInstitutionId,
    queryInstitutionId,
    mode: options.mode,
  });
}
