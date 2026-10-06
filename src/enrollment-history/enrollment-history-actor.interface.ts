import type { Request } from 'express';

export interface EnrollmentHistoryActorContext {
  req: Request;
  permisos: string[];
  ambitos: string[];
  esAdmin: boolean;
  institutionId?: number | null;
}
