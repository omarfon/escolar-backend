import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Institution } from '../institution/entities/institution.entity';

export type AlcanceNivel = 'IE' | 'UGEL' | 'DRE' | 'MINEDU';

export interface ReportScope {
  mode: 'institucion' | 'consolidado';
  institutionIds: number[];
  alcance: {
    nivel: AlcanceNivel;
    dre: string | null;
    ugel: string | null;
    label: string;
    institucionesCount: number;
  };
  primaryInstitutionId: number;
  scopeKey: string;
}

export function nivelAlcanceReporte(user: RequestUser): AlcanceNivel {
  if (
    user.esAdmin ||
    user.ambitos?.includes('MINEDU') ||
    user.roles.includes('MINEDU')
  ) {
    return 'MINEDU';
  }
  if (user.ambitos?.includes('DRE') || user.roles.includes('DRE')) {
    return 'DRE';
  }
  if (user.ambitos?.includes('UGEL') || user.roles.includes('UGEL')) {
    return 'UGEL';
  }
  return 'IE';
}

export function esAlcanceTerritorial(user: RequestUser): boolean {
  const nivel = nivelAlcanceReporte(user);
  return nivel !== 'IE' || esSuperusuarioSiagie(user);
}

function buildScopeKey(
  nivel: AlcanceNivel,
  dre: string | null,
  ugel: string | null,
  institutionId?: number,
): string {
  if (institutionId != null && institutionId > 0) {
    return `ie:${institutionId}`;
  }
  if (nivel === 'UGEL' && ugel) return `ugel:${ugel.toLowerCase()}`;
  if (nivel === 'DRE' && dre) return `dre:${dre.toLowerCase()}`;
  if (dre && ugel) return `minedu:${dre.toLowerCase()}:${ugel.toLowerCase()}`;
  if (dre) return `minedu:dre:${dre.toLowerCase()}`;
  if (ugel) return `minedu:ugel:${ugel.toLowerCase()}`;
  return 'minedu:global';
}

function buildAlcanceLabel(
  nivel: AlcanceNivel,
  dre: string | null,
  ugel: string | null,
  count: number,
): string {
  if (nivel === 'IE') return 'Institución educativa';
  const parts: string[] = [];
  if (nivel === 'MINEDU') parts.push('Consolidado MINEDU');
  else if (nivel === 'DRE') parts.push(`Consolidado DRE ${dre ?? ''}`.trim());
  else parts.push(`Consolidado UGEL ${ugel ?? ''}`.trim());
  parts.push(`${count} IE`);
  return parts.join(' · ');
}

export async function resolveReportScope(
  user: RequestUser,
  req: Request,
  institutionRepo: Repository<Institution>,
  queryDre?: string,
  queryUgel?: string,
): Promise<ReportScope> {
  const nivel = nivelAlcanceReporte(user);
  const ieSeleccionada = institutionIdDeAlcance(user, req);

  if (ieSeleccionada != null && ieSeleccionada > 0) {
    const inst = await institutionRepo.findOne({ where: { id: ieSeleccionada } });
    if (!inst) {
      throw new NotFoundException('Institución educativa no encontrada');
    }
    return {
      mode: 'institucion',
      institutionIds: [ieSeleccionada],
      alcance: {
        nivel: 'IE',
        dre: inst.dre || null,
        ugel: inst.ugel || null,
        label: inst.nombre || 'Institución educativa',
        institucionesCount: 1,
      },
      primaryInstitutionId: ieSeleccionada,
      scopeKey: buildScopeKey('IE', inst.dre, inst.ugel, ieSeleccionada),
    };
  }

  if (nivel === 'IE' && !esSuperusuarioSiagie(user)) {
    const assigned = user.institutionId;
    if (assigned == null || assigned < 1) {
      throw new NotFoundException(
        'Seleccione una institución educativa para consultar reportes',
      );
    }
    return resolveReportScope(
      { ...user, institutionId: assigned },
      req,
      institutionRepo,
      queryDre,
      queryUgel,
    );
  }

  const qb = institutionRepo.createQueryBuilder('i');
  let dreFilter = queryDre?.trim() || null;
  let ugelFilter = queryUgel?.trim() || null;

  if (nivel === 'DRE') {
    dreFilter = dreFilter || user.dreCodigo?.trim() || null;
    if (!dreFilter) {
      throw new BadRequestException(
        'Indique la DRE de referencia (filtro o asignación territorial)',
      );
    }
    qb.andWhere('LOWER(TRIM(i.dre)) = LOWER(TRIM(:dre))', { dre: dreFilter });
  } else if (nivel === 'UGEL') {
    ugelFilter = ugelFilter || user.ugelCodigo?.trim() || null;
    if (!ugelFilter) {
      throw new BadRequestException(
        'Indique la UGEL de referencia (filtro o asignación territorial)',
      );
    }
    qb.andWhere('LOWER(TRIM(i.ugel)) = LOWER(TRIM(:ugel))', { ugel: ugelFilter });
  } else {
    if (dreFilter) {
      qb.andWhere('LOWER(TRIM(i.dre)) = LOWER(TRIM(:dre))', { dre: dreFilter });
    }
    if (ugelFilter) {
      qb.andWhere('LOWER(TRIM(i.ugel)) = LOWER(TRIM(:ugel))', { ugel: ugelFilter });
    }
  }

  const institutions = await qb.orderBy('i.nombre', 'ASC').getMany();
  if (!institutions.length) {
    throw new NotFoundException('No hay instituciones en el ámbito territorial seleccionado');
  }

  const alcanceNivel: AlcanceNivel =
    nivel === 'IE' && esSuperusuarioSiagie(user) ? 'MINEDU' : nivel;
  const scopeKey = buildScopeKey(alcanceNivel, dreFilter, ugelFilter);
  const primaryId = institutions[0].id;

  return {
    mode: institutions.length > 1 ? 'consolidado' : 'institucion',
    institutionIds: institutions.map((i) => i.id),
    alcance: {
      nivel: alcanceNivel,
      dre: dreFilter,
      ugel: ugelFilter,
      label: buildAlcanceLabel(alcanceNivel, dreFilter, ugelFilter, institutions.length),
      institucionesCount: institutions.length,
    },
    primaryInstitutionId: primaryId,
    scopeKey,
  };
}
