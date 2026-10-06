import type { Request } from 'express';

export interface TransferActorContext {
  req: Request;
  permisos: string[];
  ambitos: string[];
  esAdmin: boolean;
  institutionId?: number | null;
  /** Código UGEL de la asignación RBAC principal (ámbito territorial). */
  ugelCodigo?: string | null;
  /** Código DRE de la asignación RBAC principal (ámbito territorial). */
  dreCodigo?: string | null;
}
