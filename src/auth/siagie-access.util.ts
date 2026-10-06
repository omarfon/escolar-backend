export {
  TENANT_INSTITUTION_HEADER,
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
  parseInstitutionId,
  resolveTenantScope,
  resolveTenantScopeFromRequest,
  resolverInstitutionId,
} from './tenant-scope.util';

export type {
  ResolvedTenantScope,
  ResolverInstitutionIdInput,
  TenantRequest,
  TenantScopeMode,
  TenantScopeOptions,
  TenantScopeSource,
} from './tenant-scope.util';
