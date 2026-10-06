import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Institution } from './entities/institution.entity';

/** Resuelve IE por id; nunca hace fallback a la primera IE de la BD. */
export async function resolveInstitutionOrFail(
  repo: Repository<Institution>,
  institutionId?: number | null,
): Promise<Institution> {
  if (institutionId == null || institutionId < 1) {
    throw new BadRequestException(
      'Seleccione una institución educativa (header X-Institution-Id o query institutionId)',
    );
  }
  const row = await repo.findOneBy({ id: institutionId });
  if (!row) {
    throw new NotFoundException(`Institución educativa ${institutionId} no encontrada`);
  }
  return row;
}
