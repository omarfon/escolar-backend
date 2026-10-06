import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  institutionIdDeAlcance,
  InstitutionScopeRequest,
} from '../auth/tenant-scope.util';
import { AuditAccion, AuditNivel } from './entities/audit-log.entity';

const SENSITIVE_KEYS = [
  'password',
  'contraseña',
  'contrasena',
  'accesstoken',
  'refreshtoken',
  'token',
  'secret',
];

export interface AuditActor {
  usuarioId: number | null;
  usuarioNombre: string;
  usuarioRol: string;
}

export interface AuditHttpMeta {
  accion: AuditAccion;
  modulo: string;
  entidad: string;
  entidadId: string | null;
  descripcion: string;
  nivel: AuditNivel;
}

type RequestWithUser = Request & { user?: RequestUser };

export function getCorrelationId(req: Request): string {
  const header =
    req.headers['x-correlation-id'] ??
    req.headers['x-request-id'] ??
    req.headers['idempotency-key'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim().slice(0, 64);
  }
  return cryptoRandomId();
}

function cryptoRandomId(): string {
  try {
    return randomUUID();
  } catch {
    return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? '';
}

/** IE activa para bitácora (asignación RBAC o header/query SIAGIE). */
export function resolveAuditInstitutionId(req?: Request): number | null {
  if (!req) return null;
  const user = (req as RequestWithUser).user;
  const id = institutionIdDeAlcance(user, req as InstitutionScopeRequest);
  if (id == null || id < 1) return null;
  return id;
}

export function parseActorFromRequest(req: Request): AuditActor {
  const attached = (req as RequestWithUser).user;
  if (attached) {
    return {
      usuarioId: Number(attached.id) || null,
      usuarioNombre: attached.nombre?.trim() || attached.username || 'Usuario',
      usuarioRol: attached.roles?.[0] ?? '',
    };
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { usuarioId: null, usuarioNombre: 'Anónimo', usuarioRol: '' };
  }

  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length < 2) {
    return { usuarioId: null, usuarioNombre: 'Anónimo', usuarioRol: '' };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as {
      sub?: string;
      username?: string;
      nombre?: string;
      roles?: string[];
    };
    const rol = payload.roles?.[0] ?? '';
    const nombre =
      payload.nombre?.trim() || payload.username?.trim() || 'Usuario';
    const id = payload.sub ? Number(payload.sub) : null;
    return {
      usuarioId: Number.isFinite(id) ? id : null,
      usuarioNombre: nombre,
      usuarioRol: rol,
    };
  } catch {
    return { usuarioId: null, usuarioNombre: 'Anónimo', usuarioRol: '' };
  }
}

export function sanitizeAuditPayload(
  value: unknown,
): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;

  const walk = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.slice(0, 20).map(walk);
    }
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        const lower = key.toLowerCase();
        if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
          out[key] = '[redactado]';
        } else {
          out[key] = walk(val);
        }
      }
      return out;
    }
    return input;
  };

  const sanitized = walk(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : { valor: sanitized };
}

export function shouldSkipAuditPath(path: string): boolean {
  const p = normalizePath(path);
  return (
    p.startsWith('/audit-logs') ||
    p === '/health' ||
    p.startsWith('/auth/login') ||
    p.startsWith('/auth/logout') ||
    p.startsWith('/auth/refresh')
  );
}

export function shouldAuditGetPath(path: string): boolean {
  const p = normalizePath(path);
  return p.includes('/export') || p.endsWith('/template');
}

export function resolveHttpAuditMeta(
  method: string,
  path: string,
  body?: unknown,
): AuditHttpMeta {
  const p = normalizePath(path);
  const segments = p.split('/').filter(Boolean);
  const resource = segments[0] ?? 'sistema';
  const sub = segments[1] ?? '';
  const id = segments.find((s) => /^\d+$/.test(s)) ?? null;

  const modulo = mapModulo(resource, segments);
  const accion = mapAccion(method, p);
  const entidad = mapEntidad(resource, sub, p);
  const entidadId = id ?? extractIdFromBody(body);
  const descripcion = buildDescripcion(accion, modulo, entidad, p, body);
  const nivel = mapNivel(accion, p, method);

  return { accion, modulo, entidad, entidadId, descripcion, nivel };
}

function normalizePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/^\/api\/v1/, '')
    .replace(/\/+$/, '') || '/';
}

function mapModulo(resource: string, segments: string[]): string {
  if (resource === 'maestros' && segments[1]) {
    return segments[1].replace(/-/g, '_');
  }
  const map: Record<string, string> = {
    auth: 'autenticacion',
    users: 'usuarios',
    students: 'matricula',
    attendances: 'asistencia',
    grades: 'evaluacion',
    actas: 'evaluacion',
    announcements: 'comunicaciones',
    events: 'comunicaciones',
    resources: 'recursos',
    tasks: 'recursos',
    institution: 'institucion',
    roles: 'usuarios',
    waitlist: 'matricula',
    'enrollment-evaluations': 'matricula',
    'enrollment-feedbacks': 'matricula',
    'enrollment-history': 'matricula',
    'transfer-requests': 'traslados',
    parents: 'portal_padres',
    'continuity-enrollment': 'matricula',
    'conduct-incidents': 'convivencia',
    curricula: 'academico',
    horarios: 'horarios',
    schedules: 'horarios',
    courses: 'academico',
  };
  return map[resource] ?? resource.replace(/-/g, '_');
}

function mapAccion(method: string, path: string): AuditAccion {
  const m = method.toUpperCase();
  if (path.includes('/export') || (m === 'GET' && path.endsWith('/template'))) {
    return 'exportar';
  }
  if (path.includes('/reject') || path.includes('/rechazar')) return 'rechazar';
  if (
    path.includes('/approve') ||
    path.includes('/aprobar') ||
    path.includes('/assign') ||
    path.includes('/close') ||
    path.includes('/actual') ||
    path.includes('/approve-all')
  ) {
    return 'aprobar';
  }
  if (path.includes('institution') && (m === 'PATCH' || m === 'PUT')) {
    return 'configurar';
  }
  if (m === 'POST') return 'crear';
  if (m === 'PATCH' || m === 'PUT') return 'actualizar';
  if (m === 'DELETE') return 'eliminar';
  return 'consultar';
}

function mapEntidad(resource: string, sub: string, path: string): string {
  if (path.includes('daily-register')) return 'registro_asistencia';
  if (path.includes('justifications')) return 'justificacion';
  if (path.includes('bulk-matricula')) return 'matricula_masiva';
  if (path.includes('registry')) return 'registro_notas';
  if (resource === 'maestros') return sub || 'maestro';
  const map: Record<string, string> = {
    users: 'usuario',
    students: 'estudiante',
    attendances: 'asistencia',
    grades: 'nota',
    actas: 'acta',
    announcements: 'comunicado',
    events: 'evento',
    resources: 'recurso',
    tasks: 'tarea',
    institution: 'institucion',
    roles: 'rol',
    waitlist: 'lista_espera',
    'enrollment-evaluations': 'evaluacion_matricula',
    'enrollment-feedbacks': 'retroalimentacion_matricula',
    'enrollment-history': 'historial_matricula',
    'transfer-requests': 'solicitud_traslado',
    parents: 'seguimiento_padre',
    'continuity-enrollment': 'continuidad',
    'conduct-incidents': 'incidente',
    curricula: 'curricula',
    horarios: 'horario',
  };
  return map[resource] ?? resource;
}

function extractIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  for (const key of ['id', 'studentId', 'usuarioId', 'userId']) {
    if (record[key] !== undefined && record[key] !== null) {
      return String(record[key]);
    }
  }
  return null;
}

function buildDescripcion(
  accion: AuditAccion,
  modulo: string,
  entidad: string,
  path: string,
  body: unknown,
): string {
  if (path.includes('registry/bulk')) return 'Guardó registro de notas por componentes';
  if (path.includes('formulas-evaluacion')) {
    return `${accion === 'crear' ? 'Creó' : 'Actualizó'} fórmula de evaluación`;
  }
  const verb =
    {
      crear: 'Creó',
      actualizar: 'Actualizó',
      eliminar: 'Eliminó',
      login: 'Inició sesión',
      logout: 'Cerró sesión',
      exportar: 'Exportó',
      aprobar: 'Aprobó',
      rechazar: 'Rechazó',
      publicar: 'Publicó',
      configurar: 'Configuró',
      consultar: 'Consultó',
    }[accion] ?? 'Ejecutó';
  const routeHint = path.replace(/^\//, '').replace(/\//g, ' › ');
  return `${verb} ${entidad.replace(/_/g, ' ')} (${modulo}) — ${routeHint}`;
}

function mapNivel(
  accion: AuditAccion,
  path: string,
  method: string,
): AuditNivel {
  if (accion === 'eliminar') return 'warning';
  if (path.includes('registry')) return 'info';
  if (method.toUpperCase() === 'DELETE') return 'warning';
  return 'info';
}
