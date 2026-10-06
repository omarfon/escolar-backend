import { BadRequestException } from '@nestjs/common';
import type { Institution } from '../institution/entities/institution.entity';
import type { TransferRequest } from './entities/transfer-request.entity';
import type { TransferActorContext } from './transfer-actor.interface';
import { iePuedeVerSolicitud } from './transfer-state.util';

export type NivelAlcanceTraslado = 'MINEDU' | 'DRE' | 'UGEL' | 'IE';

export type FuenteAlcanceTerritorial = 'asignacion' | 'institucion_referencia' | 'global';

export interface ResolvedTransferTerritorialScope {
  nivel: NivelAlcanceTraslado;
  ugel: string | null;
  dre: string | null;
  institution: Institution | null;
  fuente: FuenteAlcanceTerritorial;
}

export function nivelAlcanceTraslado(
  ctx: Pick<TransferActorContext, 'esAdmin' | 'ambitos'>,
): NivelAlcanceTraslado {
  if (ctx.esAdmin || ctx.ambitos.includes('MINEDU')) return 'MINEDU';
  if (ctx.ambitos.includes('DRE')) return 'DRE';
  if (ctx.ambitos.includes('UGEL')) return 'UGEL';
  return 'IE';
}

export function requiereInstitucionReferencia(nivel: NivelAlcanceTraslado): boolean {
  return nivel === 'IE';
}

/** Resuelve UGEL/DRE desde asignación RBAC o IE de referencia; nunca inventa valores. */
export function resolverAlcanceTerritorial(
  ctx: TransferActorContext,
  institution: Institution | null,
): ResolvedTransferTerritorialScope {
  const nivel = nivelAlcanceTraslado(ctx);

  if (nivel === 'MINEDU') {
    return {
      nivel,
      ugel: null,
      dre: null,
      institution,
      fuente: institution ? 'institucion_referencia' : 'global',
    };
  }

  if (nivel === 'IE') {
    if (!institution) {
      throw new BadRequestException(
        'Seleccione la institución educativa activa para operar traslados.',
      );
    }
    return {
      nivel,
      ugel: null,
      dre: null,
      institution,
      fuente: 'institucion_referencia',
    };
  }

  if (nivel === 'UGEL') {
    const fromAssignment = ctx.ugelCodigo?.trim() || null;
    const fromInstitution = institution?.ugel?.trim() || null;
    const ugel = fromAssignment || fromInstitution;
    if (!ugel) {
      throw new BadRequestException(
        'Indique la UGEL de referencia (asignación territorial o institución educativa activa).',
      );
    }
    return {
      nivel,
      ugel,
      dre: null,
      institution,
      fuente: fromAssignment ? 'asignacion' : 'institucion_referencia',
    };
  }

  const fromAssignment = ctx.dreCodigo?.trim() || null;
  const fromInstitution = institution?.dre?.trim() || null;
  const dre = fromAssignment || fromInstitution;
  if (!dre) {
    throw new BadRequestException(
      'Indique la DRE de referencia (asignación territorial o institución educativa activa).',
    );
  }

  return {
    nivel,
    ugel: null,
    dre,
    institution,
    fuente: fromAssignment ? 'asignacion' : 'institucion_referencia',
  };
}

export function aplicarFiltroTerritorialAlcance(
  qb: ReturnType<import('typeorm').Repository<TransferRequest>['createQueryBuilder']>,
  scope: ResolvedTransferTerritorialScope,
): void {
  if (scope.nivel === 'MINEDU') return;

  if (scope.nivel === 'DRE' && scope.dre) {
    qb.andWhere('LOWER(t.ieOrigenDre) = LOWER(:dre)', { dre: scope.dre });
    return;
  }

  if (scope.nivel === 'UGEL' && scope.ugel) {
    qb.andWhere('LOWER(t.ieOrigenUgel) = LOWER(:ugel)', { ugel: scope.ugel });
    return;
  }

  const modular = (scope.institution?.codigoModular ?? '').trim();
  if (!modular) {
    throw new BadRequestException(
      'Seleccione la institución educativa activa para operar traslados.',
    );
  }

  qb.andWhere(
    `(t."ieOrigenCodigoModular" = :modular OR (t."ieDestinoCodigoModular" = :modular AND t.estado <> 'borrador'))`,
    { modular },
  );
}

export function solicitudFueraDeAlcance(
  row: TransferRequest,
  scope: ResolvedTransferTerritorialScope,
): boolean {
  if (scope.nivel === 'MINEDU') return false;

  if (scope.nivel === 'DRE' && scope.dre) {
    return row.ieOrigenDre.toLowerCase() !== scope.dre.toLowerCase();
  }

  if (scope.nivel === 'UGEL' && scope.ugel) {
    return row.ieOrigenUgel.toLowerCase() !== scope.ugel.toLowerCase();
  }

  const modular = (scope.institution?.codigoModular ?? '').trim();
  return !iePuedeVerSolicitud(
    modular,
    row.ieOrigenCodigoModular,
    row.ieDestinoCodigoModular,
    row.estado,
  );
}
