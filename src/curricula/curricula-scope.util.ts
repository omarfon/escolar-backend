import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import {
  MaestrosAuthRequest,
  assertMaestroBelongsToInstitution,
  requireMaestrosInstitutionId,
  resolveMaestrosInstitutionId,
} from '../maestros/common/maestros-tenant.util';
import { Curriculum } from './entities/curriculum.entity';

export interface CurriculaActorContext {
  req?: Request;
  institutionId?: number;
}

export function scopeFromCurriculaRequest(req?: Request): CurriculaActorContext {
  const maestrosReq = req as MaestrosAuthRequest | undefined;
  return {
    req,
    institutionId: resolveMaestrosInstitutionId(maestrosReq),
  };
}

export function requireCurriculaInstitutionId(req: Request): number {
  return requireMaestrosInstitutionId(req as MaestrosAuthRequest);
}

export function assertCurriculumInScope(
  curriculum: Curriculum,
  institutionId?: number,
): void {
  if (institutionId == null) return;
  assertMaestroBelongsToInstitution(curriculum, institutionId);
}

export function emptyCatalogWhenUnscoped<T extends Record<string, unknown>>(
  scoped: boolean,
  empty: T,
): T | null {
  return scoped ? empty : null;
}

export function curriculumNotFound(): never {
  throw new NotFoundException('Currícula no encontrada');
}
