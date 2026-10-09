import { esSuperusuarioSiagie } from '../auth/siagie-access.util';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { PERMISSION_SECTIONS, SectionDef } from './roles.constants';

/** Roles operativos de IE (matrícula, aula, tesorería, etc.). */
export const ROLES_PRINCIPALES_IE = [
  'ADMIN',
  'DIRECTOR',
  'DOCENTE',
  'SECRETARIA',
  'TESORERO',
  'PADRE',
  'ESTUDIANTE',
  'BIBLIOTECARIO',
] as const;

/** Solo ADMIN nacional y SIAGIE los listan y gestionan en catálogo completo. */
export const ROLES_RESERVADOS_PLATAFORMA = ['SIAGIE', 'UGEL', 'DRE', 'MINEDU'] as const;

export type ViewerIdentity = Pick<RequestUser, 'roles' | 'rolPrincipal'> | null | undefined;

export function esAdminNacional(viewer?: ViewerIdentity): boolean {
  if (!viewer) return false;
  return viewer.rolPrincipal === 'ADMIN' || (viewer.roles ?? []).includes('ADMIN');
}

/** Catálogo completo de roles y permisos: rol ADMIN o superusuario SIAGIE. */
export function puedeVerCatalogoRbacCompleto(viewer?: ViewerIdentity): boolean {
  return esSuperusuarioSiagie(viewer) || esAdminNacional(viewer);
}

const PERMISOS_SOLO_CATALOGO_COMPLETO = new Set([
  'dashboard.reportes',
  'admin.reportes',
]);

export function permisoVisibleEnGestion(codigo: string, catalogoCompleto: boolean): boolean {
  if (catalogoCompleto) return true;
  if (codigo.startsWith('admin.')) return false;
  if (PERMISOS_SOLO_CATALOGO_COMPLETO.has(codigo)) return false;
  return true;
}

export function catalogoPermisosParaGestion(catalogoCompleto: boolean): SectionDef[] {
  if (catalogoCompleto) return PERMISSION_SECTIONS;
  return PERMISSION_SECTIONS.map((section) => ({
    ...section,
    permisos: section.permisos.filter((p) => permisoVisibleEnGestion(p.codigo, false)),
  })).filter((section) => section.permisos.length > 0);
}

export function codigosPermisosGestionables(catalogoCompleto: boolean): Set<string> {
  const codes = catalogoPermisosParaGestion(catalogoCompleto).flatMap((s) =>
    s.permisos.map((p) => p.codigo),
  );
  return new Set(codes);
}

export function rolVisibleParaGestion(
  codigo: string,
  institutionId: number | null,
  alcanceInstitutionId: number | undefined,
  viewer?: ViewerIdentity,
): boolean {
  if (puedeVerCatalogoRbacCompleto(viewer)) {
    if (alcanceInstitutionId === undefined || alcanceInstitutionId < 1) return true;
    return institutionId == null || institutionId === alcanceInstitutionId;
  }

  if ((ROLES_RESERVADOS_PLATAFORMA as readonly string[]).includes(codigo)) {
    return false;
  }

  if (institutionId != null) {
    if (alcanceInstitutionId === undefined || alcanceInstitutionId < 1) return false;
    return institutionId === alcanceInstitutionId;
  }

  return (ROLES_PRINCIPALES_IE as readonly string[]).includes(codigo);
}

export function filtrarPermisosParaRespuesta(
  permisos: string[],
  catalogoCompleto: boolean,
): string[] {
  if (catalogoCompleto) return permisos;
  return permisos.filter((p) => permisoVisibleEnGestion(p, false));
}

export function fusionarPermisosAlGuardar(
  solicitados: string[],
  permisosAnteriores: string[],
  catalogoCompleto: boolean,
): string[] {
  if (catalogoCompleto) return [...new Set(solicitados)];
  const allowed = codigosPermisosGestionables(false);
  const ocultos = permisosAnteriores.filter((p) => !allowed.has(p));
  const visibles = solicitados.filter((p) => allowed.has(p));
  return [...new Set([...visibles, ...ocultos])];
}
