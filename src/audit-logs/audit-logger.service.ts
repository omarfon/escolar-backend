import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import {
  AuditActor,
  getClientIp,
  parseActorFromRequest,
  resolveHttpAuditMeta,
  sanitizeAuditPayload,
} from './audit-context.util';
import { AuditAccion, AuditNivel } from './entities/audit-log.entity';

export interface AuditLogInput {
  accion: AuditAccion;
  modulo: string;
  entidad: string;
  descripcion: string;
  usuarioId?: number | null;
  usuarioNombre?: string;
  usuarioRol?: string;
  entidadId?: string | null;
  detalle?: Record<string, unknown> | null;
  ip?: string;
  nivel?: AuditNivel;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  log(input: AuditLogInput): void {
    void this.safeCreate(input);
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
      const sanitizedResponse = sanitizeAuditPayload(responseBody);
      if (sanitizedResponse) detalle.response = sanitizedResponse;
    }
    if (errorMessage) detalle.error = errorMessage;

    this.log({
      ...meta,
      ...actor,
      entidadId: meta.entidadId ?? extractResponseId(responseBody),
      nivel: outcome === 'error' ? 'warning' : meta.nivel,
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
    actor: Partial<AuditActor> & { usuarioNombre: string },
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
      nivel: outcome === 'success' ? 'info' : 'warning',
      detalle: detalle ?? null,
      ip: getClientIp(req),
    });
  }

  private async safeCreate(input: AuditLogInput): Promise<void> {
    try {
      await this.auditLogsService.create({
        accion: input.accion,
        modulo: input.modulo,
        entidad: input.entidad,
        descripcion: input.descripcion,
        usuarioId: input.usuarioId ?? undefined,
        usuarioNombre: input.usuarioNombre,
        usuarioRol: input.usuarioRol,
        entidadId: input.entidadId ?? undefined,
        detalle: input.detalle ?? undefined,
        ip: input.ip,
        nivel: input.nivel,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo registrar bitácora: ${message}`);
    }
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
