import type { Institution } from '../institution/entities/institution.entity';
import type { TransferRequest } from './entities/transfer-request.entity';
import type { TransferNotification } from './entities/transfer-notification.entity';

export type NivelAlcanceTraslado = 'MINEDU' | 'DRE' | 'UGEL' | 'IE';

export function nivelAlcanceDesdeContexto(
  esAdmin: boolean,
  ambitos: string[],
): NivelAlcanceTraslado {
  if (esAdmin || ambitos.includes('MINEDU')) return 'MINEDU';
  if (ambitos.includes('DRE')) return 'DRE';
  if (ambitos.includes('UGEL')) return 'UGEL';
  return 'IE';
}

/** Indica si el actor puede marcar como leída una notificación según usuario resuelto o ámbito. */
export function usuarioEsDestinatarioNotificacion(
  notification: Pick<TransferNotification, 'ambito' | 'destinatarioUserId'>,
  row: Pick<
    TransferRequest,
    'ieOrigenCodigoModular' | 'ieDestinoCodigoModular' | 'ieOrigenUgel' | 'ieOrigenDre'
  >,
  institution: Pick<Institution, 'codigoModular' | 'ugel' | 'dre'>,
  nivel: NivelAlcanceTraslado,
  actorUserId?: number | null,
): boolean {
  if (
    notification.destinatarioUserId != null &&
    actorUserId != null &&
    notification.destinatarioUserId === actorUserId
  ) {
    return true;
  }
  if (notification.destinatarioUserId != null) {
    return false;
  }

  const modular = (institution.codigoModular ?? '').trim();
  switch (notification.ambito) {
    case 'IE_ORIGEN':
      return modular === row.ieOrigenCodigoModular.trim();
    case 'IE_DESTINO':
      return modular === row.ieDestinoCodigoModular.trim();
    case 'UGEL':
      if (nivel === 'MINEDU' || nivel === 'DRE' || nivel === 'UGEL') return true;
      return (
        !!institution.ugel &&
        institution.ugel.toLowerCase() === row.ieOrigenUgel.toLowerCase()
      );
    case 'DRE':
      if (nivel === 'MINEDU' || nivel === 'DRE') return true;
      return (
        !!institution.dre &&
        institution.dre.toLowerCase() === row.ieOrigenDre.toLowerCase()
      );
    case 'MINEDU':
      return nivel === 'MINEDU';
    default:
      return false;
  }
}
