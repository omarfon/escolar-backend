import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  institutionIdDeAlcance,
  InstitutionScopeRequest,
} from '../../auth/tenant-scope.util';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { Institution } from '../../institution/entities/institution.entity';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';

export type MaestrosAuthRequest = InstitutionScopeRequest & { user?: RequestUser };

/** Resuelve IE activa y años lectivos registrados para esa IE. */
export async function resolveMaestrosAniosEscolares(
  req: MaestrosAuthRequest,
  anioEscolarRepo: Repository<MaestroAnioEscolar>,
): Promise<{ institutionId: number; anios: number[] } | null> {
  const institutionId = institutionIdDeAlcance(req.user, req);
  if (institutionId == null || institutionId < 1) return null;

  const rows = await anioEscolarRepo.find({
    where: { institutionId, activo: true },
    select: { anio: true },
    order: { anio: 'DESC' },
  });
  return { institutionId, anios: rows.map((r) => r.anio) };
}

/** Exige IE activa; lanza si SIAGIE no seleccionó institución. */
export async function requireMaestrosAniosEscolares(
  req: MaestrosAuthRequest,
  anioEscolarRepo: Repository<MaestroAnioEscolar>,
): Promise<{ institutionId: number; anios: number[] }> {
  const scope = await resolveMaestrosAniosEscolares(req, anioEscolarRepo);
  if (!scope) {
    throw new BadRequestException(
      'Seleccione una institución educativa (header X-Institution-Id o query institutionId)',
    );
  }
  return scope;
}

/** Resuelve IE activa del request (sin exigir años escolares). */
export function resolveMaestrosInstitutionId(
  req?: MaestrosAuthRequest,
): number | undefined {
  if (!req) return undefined;
  const institutionId = institutionIdDeAlcance(req.user, req);
  if (institutionId == null || institutionId < 1) return undefined;
  return institutionId;
}

/** Exige IE activa; lanza si SIAGIE no seleccionó institución. */
export function requireMaestrosInstitutionId(req: MaestrosAuthRequest): number {
  const institutionId = resolveMaestrosInstitutionId(req);
  if (institutionId == null) {
    throw new BadRequestException(
      'Seleccione una institución educativa (header X-Institution-Id o query institutionId)',
    );
  }
  return institutionId;
}

/** Filtra query por años de la IE; devuelve vacío si la IE no tiene años. */
export function filterAniosEscolaresPorInstitucion(
  aniosInstitucion: number[],
  anioEscolar?: number,
): number[] {
  if (!aniosInstitucion.length) return [];
  if (anioEscolar != null) {
    return aniosInstitucion.includes(anioEscolar) ? [anioEscolar] : [];
  }
  return aniosInstitucion;
}

/** Aplica filtro IN por años institucionales. false = resultado vacío garantizado. */
export function applyAniosInstitucionWhere(
  qb: { andWhere: (sql: string, params: Record<string, unknown>) => unknown },
  alias: string,
  column: string,
  aniosInstitucion?: number[] | null,
): boolean {
  if (aniosInstitucion === undefined || aniosInstitucion === null) return true;
  if (!aniosInstitucion.length) return false;
  qb.andWhere(`${alias}.${column} IN (:...aniosInstitucion)`, {
    aniosInstitucion,
  });
  return true;
}

/** Aplica filtro directo por institutionId en la entidad maestro. */
export function applyInstitutionIdWhere(
  qb: { andWhere: (sql: string, params: Record<string, unknown>) => unknown },
  alias: string,
  institutionId?: number | null,
): boolean {
  if (institutionId == null) return true;
  qb.andWhere(`${alias}.institutionId = :institutionId`, { institutionId });
  return true;
}

/** Valida que un registro pertenezca a la IE del contexto (update/delete). */
export function assertMaestroBelongsToInstitution(
  entity: { institutionId?: number | null },
  institutionId: number,
): void {
  if (entity.institutionId !== institutionId) {
    throw new NotFoundException('Registro no encontrado');
  }
}

/** IE por defecto para seeds de catálogo (primera IE registrada). */
export async function resolveSeedInstitutionId(
  institutionRepo: Repository<Institution>,
): Promise<number> {
  const inst = await institutionRepo.findOne({ order: { id: 'ASC' } });
  if (!inst) {
    throw new BadRequestException(
      'No hay institución registrada para inicializar catálogos',
    );
  }
  return inst.id;
}
