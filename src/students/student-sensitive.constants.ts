/** Campos clasificados como datos personales sensibles (finalidad educativa). */
export const SENSITIVE_PERSONAL_FIELDS = [
  'dni',
  'email',
  'fechaNac',
  'sexo',
  'direccion',
  'distrito',
  'provincia',
  'departamento',
  'telefonoEmergencia',
  'grupoSanguineo',
  'alergias',
  'condicionesSalud',
  'foto',
  'padre',
  'madre',
  'apoderado',
] as const;

export type SensitivePersonalField = (typeof SENSITIVE_PERSONAL_FIELDS)[number];

export const SENSITIVE_FIELD_LABELS: Record<string, string> = {
  dni: 'Documento de identidad',
  email: 'Correo electrónico',
  fechaNac: 'Fecha de nacimiento',
  sexo: 'Sexo',
  direccion: 'Dirección',
  distrito: 'Distrito',
  provincia: 'Provincia',
  departamento: 'Departamento',
  telefonoEmergencia: 'Teléfono de emergencia',
  grupoSanguineo: 'Grupo sanguíneo',
  alergias: 'Alergias',
  condicionesSalud: 'Condiciones de salud',
  foto: 'Fotografía',
  padre: 'Datos del padre',
  madre: 'Datos de la madre',
  apoderado: 'Datos del apoderado',
};

/** Activar notificaciones por correo (puede desactivarse vía env). */
export function isSensitiveNotificationEnabled(): boolean {
  const raw = process.env.NOTIFY_SENSITIVE_STUDENT_CHANGES;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}
