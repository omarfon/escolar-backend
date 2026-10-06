import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Institution } from '../institution/entities/institution.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import type { AmbitoNotificacionTraslado } from './transfer-notification.constants';
import {
  PERMISO_TRASLADOS_APROBAR_DESTINO,
  PERMISO_TRASLADOS_RESOLVER,
  PERMISO_TRASLADOS_SOLICITAR,
} from './transfer.constants';

export type DestinatarioNotificacionTipo = 'usuario' | 'rol_ambito' | 'institucion';

export interface TransferRecipientResolved {
  destinatarioTipo: DestinatarioNotificacionTipo;
  destinatarioUserId: number | null;
  destinatarioEmail: string;
  destinatario: string;
  destinatarioInstitutionId: number | null;
  destinatarioAmbitoNivel: string;
  destinatarioRol: string;
}

interface RecipientRow {
  userId: number;
  nombres: string;
  apellidos: string;
  email: string;
  roleCodigo: string;
  assignmentAmbito: string;
  institutionId: number | null;
}

const PERMISO_POR_AMBITO: Record<AmbitoNotificacionTraslado, string> = {
  IE_ORIGEN: PERMISO_TRASLADOS_SOLICITAR,
  IE_DESTINO: PERMISO_TRASLADOS_APROBAR_DESTINO,
  UGEL: PERMISO_TRASLADOS_RESOLVER,
  DRE: PERMISO_TRASLADOS_RESOLVER,
  MINEDU: PERMISO_TRASLADOS_RESOLVER,
};

@Injectable()
export class TransferRecipientResolverService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async resolveRecipients(
    row: TransferRequest,
    ambito: AmbitoNotificacionTraslado,
  ): Promise<TransferRecipientResolved[]> {
    const permiso = PERMISO_POR_AMBITO[ambito];
    const filter = await this.buildFilter(row, ambito);
    const rows = (await this.dataSource.query(
      `
      SELECT DISTINCT u.id AS "userId", u.nombres, u.apellidos, u.email,
             a."roleCodigo", a.ambito AS "assignmentAmbito", a."institutionId"
      FROM user_role_assignments a
      INNER JOIN users u ON u.id = a."userId" AND u.estado = 'activo'
      INNER JOIN roles r ON r.codigo = a."roleCodigo"
      INNER JOIN role_permissions rp ON rp."roleId" = r.id
      INNER JOIN permissions p ON p.id = rp."permissionId" AND p.codigo = $1
      WHERE a.activo = true
        AND (
          ($2::int IS NOT NULL AND a.ambito = 'IE' AND a."institutionId" = $2)
          OR ($3::text <> '' AND a.ambito = 'UGEL' AND LOWER(TRIM(a."ugelCodigo")) = LOWER(TRIM($3)))
          OR ($4::text <> '' AND a.ambito = 'DRE' AND LOWER(TRIM(a."dreCodigo")) = LOWER(TRIM($4)))
          OR ($5 = true AND a.ambito = 'MINEDU')
        )
      ORDER BY u.apellidos, u.nombres, a."roleCodigo"
      `,
      [
        permiso,
        filter.institutionId,
        filter.ugelCodigo ?? '',
        filter.dreCodigo ?? '',
        filter.minedu,
      ],
    )) as RecipientRow[];

    return rows.map((item) => ({
      destinatarioTipo: 'usuario' as const,
      destinatarioUserId: item.userId,
      destinatarioEmail: item.email ?? '',
      destinatario: `${item.apellidos}, ${item.nombres} (${item.roleCodigo})`,
      destinatarioInstitutionId: item.institutionId,
      destinatarioAmbitoNivel: item.assignmentAmbito,
      destinatarioRol: item.roleCodigo,
    }));
  }

  private async buildFilter(
    row: TransferRequest,
    ambito: AmbitoNotificacionTraslado,
  ): Promise<{
    institutionId: number | null;
    ugelCodigo: string | null;
    dreCodigo: string | null;
    minedu: boolean;
  }> {
    switch (ambito) {
      case 'IE_ORIGEN':
        return {
          institutionId: await this.resolveInstitutionId(
            row.ieOrigenInstitutionId,
            row.ieOrigenCodigoModular,
          ),
          ugelCodigo: null,
          dreCodigo: null,
          minedu: false,
        };
      case 'IE_DESTINO':
        return {
          institutionId: await this.resolveInstitutionId(
            row.ieDestinoInstitutionId,
            row.ieDestinoCodigoModular,
          ),
          ugelCodigo: null,
          dreCodigo: null,
          minedu: false,
        };
      case 'UGEL':
        return {
          institutionId: null,
          ugelCodigo: row.ieOrigenUgel?.trim() || null,
          dreCodigo: null,
          minedu: false,
        };
      case 'DRE':
        return {
          institutionId: null,
          ugelCodigo: null,
          dreCodigo: row.ieOrigenDre?.trim() || null,
          minedu: false,
        };
      case 'MINEDU':
        return {
          institutionId: null,
          ugelCodigo: null,
          dreCodigo: null,
          minedu: true,
        };
      default:
        return { institutionId: null, ugelCodigo: null, dreCodigo: null, minedu: false };
    }
  }

  private async resolveInstitutionId(
    institutionId: number | null | undefined,
    codigoModular: string,
  ): Promise<number | null> {
    if (institutionId) return institutionId;
    const modular = codigoModular?.trim();
    if (!modular) return null;
    const ie = await this.institutionRepo.findOneBy({ codigoModular: modular });
    return ie?.id ?? null;
  }
}
