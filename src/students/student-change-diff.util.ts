import { Student } from './entities/student.entity';
import {
  SENSITIVE_FIELD_LABELS,
  SENSITIVE_PERSONAL_FIELDS,
} from './student-sensitive.constants';

const SENSITIVE_KEYS = ['password', 'token', 'secret'];

export function snapshotStudent(student: Student): Record<string, unknown> {
  return {
    nombre: student.nombre,
    apellido: student.apellido,
    apellidoPaterno: student.apellidoPaterno,
    apellidoMaterno: student.apellidoMaterno,
    email: maskEmail(student.email),
    codigo: student.codigo,
    dni: maskDocument(student.dni),
    tipoDocumento: student.tipoDocumento,
    nivel: student.nivel,
    grado: student.grado,
    seccion: student.seccion,
    activo: student.activo,
    fechaNac: student.fechaNac,
    sexo: student.sexo,
    direccion: maskAddress(student.direccion),
    distrito: student.distrito,
    provincia: student.provincia,
    departamento: student.departamento,
    telefonoEmergencia: maskPhone(student.telefonoEmergencia),
    foto: summarizeFoto(student.foto),
    grupoSanguineo: student.grupoSanguineo,
    alergias: student.alergias,
    condicionesSalud: student.condicionesSalud,
    observaciones: student.observaciones,
    anioIngreso: student.anioIngreso,
    estadoMatricula: student.estadoMatricula,
    estadoCambioSeccion: student.estadoCambioSeccion,
    conductaNota: student.conductaNota,
    padre: sanitizeRepresentante(student.padre),
    madre: sanitizeRepresentante(student.madre),
    apoderado: sanitizeRepresentante(student.apoderado),
    estadoDocumento: student.estadoDocumento,
  };
}

export function diffStudentSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { anterior?: unknown; nuevo?: unknown }> | null {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};

  for (const key of keys) {
    const prev = before?.[key];
    const next = after?.[key];
    if (stableJson(prev) === stableJson(next)) continue;
    cambios[key] = {};
    if (before) cambios[key].anterior = prev;
    if (after) cambios[key].nuevo = next;
  }

  return Object.keys(cambios).length ? cambios : null;
}

/** Extrae solo cambios en campos clasificados como datos personales sensibles. */
export function extractSensitiveChanges(
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
): Record<string, { anterior?: unknown; nuevo?: unknown }> {
  const sensitive = new Set<string>(SENSITIVE_PERSONAL_FIELDS);
  const out: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};
  for (const [key, value] of Object.entries(cambios)) {
    if (sensitive.has(key)) out[key] = value;
  }
  return out;
}

export function sensitiveFieldLabels(campos: string[]): string[] {
  return campos.map((c) => SENSITIVE_FIELD_LABELS[c] ?? c);
}

function sanitizeRepresentante(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      out[key] = '[redactado]';
      continue;
    }
    if (key.toLowerCase().includes('dni') && typeof val === 'string') {
      out[key] = maskDocument(val);
      continue;
    }
    if (key.toLowerCase().includes('email') && typeof val === 'string') {
      out[key] = maskEmail(val);
      continue;
    }
    if (
      (key.toLowerCase().includes('telefono') || key.toLowerCase().includes('phone')) &&
      typeof val === 'string'
    ) {
      out[key] = maskPhone(val);
      continue;
    }
    out[key] = val;
  }
  return out;
}

function maskDocument(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return v ? '****' : '';
  return `${'*'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

function maskEmail(value: string): string {
  const v = value.trim();
  if (!v) return '';
  const at = v.indexOf('@');
  if (at <= 1) return '[email redactado]';
  return `${v[0]}***${v.slice(at)}`;
}

function maskPhone(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return v ? '****' : '';
  return `${'*'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

function maskAddress(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return v ? '[dirección parcial]' : '';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function summarizeFoto(value: string): string {
  if (!value?.trim()) return '';
  if (value.startsWith('data:') || value.length > 120) {
    return '[foto omitida]';
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
