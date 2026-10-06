import { Evento } from '../../events/entities/evento.entity';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { esSuperusuarioSiagie } from '../../auth/tenant-scope.util';

export type CalendarioRolVista =
  | 'gestion_ie'
  | 'docente'
  | 'padre'
  | 'alumno'
  | 'personal_ie'
  | 'territorial';

export const CALENDARIO_ROLES_PORTAL: CalendarioRolVista[] = [
  'docente',
  'padre',
  'alumno',
  'personal_ie',
];

export function esRolPortalCalendario(rolVista: CalendarioRolVista): boolean {
  return CALENDARIO_ROLES_PORTAL.includes(rolVista);
}

export interface CalendarioAudienciaContext {
  nivel?: string;
  grado?: string;
  seccion?: string;
}

export function resolveCalendarioRolVista(user: RequestUser): CalendarioRolVista {
  const roles = user.roles ?? [];
  const rol = (user.rolPrincipal ?? '').toUpperCase();

  if (user.esAdmin || roles.includes('ADMIN') || roles.includes('DIRECTOR')) {
    return 'gestion_ie';
  }

  const ambitos = (user.ambitos ?? []).map((a) => a.toUpperCase());
  if (
    esSuperusuarioSiagie(user) ||
    ambitos.some((a) => ['MINEDU', 'DRE', 'UGEL', 'SIAGIE'].includes(a))
  ) {
    return 'territorial';
  }

  if (
    roles.includes('SECRETARIA') ||
    user.permisos?.includes('calendarizacion.gestionar')
  ) {
    return 'gestion_ie';
  }

  if (roles.includes('DOCENTE') || rol === 'DOCENTE') return 'docente';
  if (roles.includes('PADRE') || rol === 'PADRE') return 'padre';
  if (roles.includes('ALUMNO') || roles.includes('ESTUDIANTE') || rol === 'ALUMNO') {
    return 'alumno';
  }

  return 'personal_ie';
}

export function puedeGestionarCalendario(user: RequestUser): boolean {
  return (
    user.esAdmin ||
    user.permisos?.includes('calendarizacion.gestionar') ||
    user.permisos?.includes('admin.institucional')
  );
}

export function eventoVisibleParaRol(
  evento: Pick<
    Evento,
    | 'publicado'
    | 'cancelado'
    | 'destinatarios'
    | 'visibilidad'
    | 'nivel'
    | 'grado'
    | 'seccion'
  >,
  rolVista: CalendarioRolVista,
  audiencia?: CalendarioAudienciaContext,
): boolean {
  if (evento.cancelado) return false;

  const gestor = rolVista === 'gestion_ie' || rolVista === 'territorial';
  if (!evento.publicado && !gestor) return false;

  if (gestor || rolVista === 'personal_ie') {
    return true;
  }

  const dest = evento.destinatarios;
  if (evento.visibilidad === 'global' || dest === 'todos') return true;

  switch (rolVista) {
    case 'docente':
      return dest === 'docentes';
    case 'padre':
      return dest === 'padres';
    case 'alumno':
      if (dest === 'alumnos') return true;
      if (dest === 'salon' && audiencia) {
        const nivelOk =
          !evento.nivel?.trim() ||
          !audiencia.nivel ||
          evento.nivel === audiencia.nivel;
        const gradoOk =
          !evento.grado?.trim() ||
          !audiencia.grado ||
          evento.grado === audiencia.grado;
        const seccionOk =
          !evento.seccion?.trim() ||
          !audiencia.seccion ||
          evento.seccion.toUpperCase() === audiencia.seccion.toUpperCase();
        return nivelOk && gradoOk && seccionOk;
      }
      return false;
    default:
      return true;
  }
}

export function etiquetaRolVista(rol: CalendarioRolVista): string {
  const map: Record<CalendarioRolVista, string> = {
    gestion_ie: 'Gestión institucional',
    docente: 'Docente',
    padre: 'Padre de familia',
    alumno: 'Estudiante',
    personal_ie: 'Personal IE',
    territorial: 'Supervisión territorial',
  };
  return map[rol];
}
