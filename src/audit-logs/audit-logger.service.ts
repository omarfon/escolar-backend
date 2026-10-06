import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { AuditWriteQueueService } from './audit-write-queue.service';
import {
  AuditActor,
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
  resolveAuditInstitutionId,
  resolveHttpAuditMeta,
  sanitizeAuditPayload,
} from './audit-context.util';
import { AuditAccion, AuditNivel, AuditResultado } from './entities/audit-log.entity';

export interface AuditLogInput {
  accion: AuditAccion;
  modulo: string;
  entidad: string;
  descripcion: string;
  usuarioId?: number | null;
  usuarioNombre?: string;
  usuarioRol?: string;
  institutionId?: number | null;
  entidadId?: string | null;
  detalle?: Record<string, unknown> | null;
  ip?: string;
  nivel?: AuditNivel;
  resultado?: AuditResultado;
  correlationId?: string | null;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly auditQueue: AuditWriteQueueService,
  ) {}

  log(input: AuditLogInput): void {
    void this.safeCreate(input);
  }

  /** Registra evento resolviendo actor, IP, correlación e IE desde el request. */
  logFromRequestContext(
    req: Request,
    input: Omit<
      AuditLogInput,
      'usuarioId' | 'usuarioNombre' | 'usuarioRol' | 'ip' | 'correlationId'
    > & { institutionId?: number | null },
  ): void {
    const actor = parseActorFromRequest(req);
    this.log({
      ...input,
      ...actor,
      institutionId: input.institutionId ?? resolveAuditInstitutionId(req),
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
    });
  }

  logFromRequest(
    req: Request,
    method: string,
    path: string,
    body: unknown,
    responseBody: unknown,
    outcome: 'success' | 'error',
    errorMessage?: string,
  ): void {
    const auditBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? { ...(body as Record<string, unknown>), ...(req.query as Record<string, unknown>) }
        : req.query;
    const meta = resolveHttpAuditMeta(method, path, auditBody);
    const actor = parseActorFromRequest(req);
    const detalle: Record<string, unknown> = {
      method: method.toUpperCase(),
      path,
      outcome,
    };
    const sanitizedBody = sanitizeAuditPayload(body);
    if (sanitizedBody) detalle.request = sanitizedBody;
    const query = req.query;
    if (query && typeof query === 'object' && Object.keys(query).length) {
      detalle.query = sanitizeAuditPayload(query) ?? query;
    }
    if (outcome === 'success' && responseBody && typeof responseBody === 'object') {
      const responseId = extractResponseId(responseBody);
      if (responseId) detalle.responseId = responseId;
    }
    if (errorMessage) detalle.error = errorMessage;

    this.log({
      ...meta,
      ...actor,
      institutionId: resolveAuditInstitutionId(req),
      entidadId: meta.entidadId ?? extractResponseId(responseBody),
      nivel: outcome === 'error' ? 'warning' : meta.nivel,
      resultado: outcome,
      correlationId: getCorrelationId(req),
      descripcion:
        outcome === 'error'
          ? `${meta.descripcion} — falló: ${errorMessage ?? 'error'}`
          : meta.descripcion,
      detalle,
      ip: getClientIp(req),
    });
  }

  logLogin(
    req: Request,
    outcome: 'success' | 'error',
    actor: Partial<AuditActor> & {
      usuarioNombre: string;
      institutionId?: number | null;
    },
    detalle?: Record<string, unknown>,
  ): void {
    this.log({
      accion: 'login',
      modulo: 'autenticacion',
      entidad: 'sesion',
      descripcion:
        outcome === 'success'
          ? 'Inicio de sesión exitoso'
          : 'Intento de inicio de sesión fallido',
      usuarioId: actor.usuarioId ?? null,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol ?? '',
      institutionId:
        actor.institutionId ?? resolveAuditInstitutionId(req) ?? null,
      nivel: outcome === 'success' ? 'info' : 'warning',
      resultado: outcome,
      correlationId: getCorrelationId(req),
      detalle: {
        ...(sanitizeAuditPayload(detalle) ?? detalle ?? {}),
        outcome,
      },
      ip: getClientIp(req),
    });
  }

  logLogout(req: Request, actor: AuditActor): void {
    this.log({
      accion: 'logout',
      modulo: 'autenticacion',
      entidad: 'sesion',
      descripcion: 'Cierre de sesión',
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      institutionId: resolveAuditInstitutionId(req),
      nivel: 'info',
      resultado: 'success',
      correlationId: getCorrelationId(req),
      detalle: {
        outcome: 'success',
        userAgent: req.headers['user-agent'] ?? '',
      },
      ip: getClientIp(req),
    });
  }

  private safeCreate(input: AuditLogInput): void {
    this.auditQueue.enqueue({
      accion: input.accion,
      modulo: input.modulo,
      entidad: input.entidad,
      descripcion: input.descripcion,
      usuarioId: input.usuarioId ?? undefined,
      usuarioNombre: input.usuarioNombre,
      usuarioRol: input.usuarioRol,
      institutionId: input.institutionId ?? undefined,
      entidadId: input.entidadId ?? undefined,
      detalle: input.detalle ?? undefined,
      ip: input.ip,
      nivel: input.nivel,
      resultado: input.resultado,
      correlationId: input.correlationId ?? undefined,
    });
  }
}

function extractResponseId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== 'object') return null;
  const record = responseBody as Record<string, unknown>;
  if (record.id !== undefined && record.id !== null) {
    return String(record.id);
  }
  return null;
}
