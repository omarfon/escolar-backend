import type { TransferRequestEvent } from '../transfers/entities/transfer-request-event.entity';
import type { TransferRequest } from '../transfers/entities/transfer-request.entity';
import {
  ACCION_REGISTRAR_MOTIVO,
  ACCION_TRASLADO_LABEL,
  type AccionTraslado,
} from '../transfers/transfer.constants';
import { iePuedeVerSolicitud } from '../transfers/transfer-state.util';
import { nivelAlcanceDesdeContexto } from '../transfers/transfer-notification-access.util';
import { EVENTO_MATRICULA_LABELS } from './enrollment-history.constants';
import type { MatriculaHistorialEvento } from './dto/enrollment-history.dto';

export interface InstitutionAlcanceHistorial {
  codigoModular?: string | null;
  ugel?: string | null;
  dre?: string | null;
}

export interface ActorAlcanceHistorial {
  esAdmin: boolean;
  ambitos: string[];
}

function fechaIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function metadataTraslado(
  transfer: TransferRequest,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    transferRequestId: transfer.id,
    codigo: transfer.codigo,
    estado: transfer.estado,
    anioEscolar: transfer.anioEscolar,
    ieOrigenNombre: transfer.ieOrigenNombre,
    ieDestinoNombre: transfer.ieDestinoNombre,
    ieOrigenCodigoModular: transfer.ieOrigenCodigoModular,
    ieDestinoCodigoModular: transfer.ieDestinoCodigoModular,
    enlaceTraslado: true,
    ...extra,
  };
}

/** Filtra solicitudes visibles según ámbito MINEDU, DRE, UGEL o IE. */
export function trasladoVisibleEnHistorial(
  transfer: Pick<
    TransferRequest,
    | 'ieOrigenCodigoModular'
    | 'ieDestinoCodigoModular'
    | 'ieOrigenUgel'
    | 'ieOrigenDre'
    | 'estado'
  >,
  institution: InstitutionAlcanceHistorial,
  actor: ActorAlcanceHistorial,
): boolean {
  const nivel = nivelAlcanceDesdeContexto(actor.esAdmin, actor.ambitos);
  if (nivel === 'MINEDU') return true;
  if (nivel === 'DRE' && institution.dre) {
    return transfer.ieOrigenDre.toLowerCase() === institution.dre.toLowerCase();
  }
  if (nivel === 'UGEL' && institution.ugel) {
    return transfer.ieOrigenUgel.toLowerCase() === institution.ugel.toLowerCase();
  }
  const modular = (institution.codigoModular ?? '').trim();
  return iePuedeVerSolicitud(
    modular,
    transfer.ieOrigenCodigoModular,
    transfer.ieDestinoCodigoModular,
    transfer.estado,
  );
}

function tituloAccionTraslado(accion: string): string {
  if (accion === ACCION_REGISTRAR_MOTIVO) {
    return 'Motivo registrado en traslado';
  }
  const label = ACCION_TRASLADO_LABEL[accion as AccionTraslado];
  return label ?? EVENTO_MATRICULA_LABELS.traslado;
}

function eventoCreacionTraslado(transfer: TransferRequest): MatriculaHistorialEvento {
  const fecha = fechaIso(transfer.createdAt);
  return {
    id: `traslado-${transfer.id}-creacion`,
    tipo: 'traslado',
    fecha,
    titulo: EVENTO_MATRICULA_LABELS.traslado,
    descripcion: `${transfer.codigo}: ${transfer.ieOrigenNombre} → ${transfer.ieDestinoNombre} (borrador)`,
    actorNombre: transfer.actorNombre,
    actorRol: transfer.actorRol,
    metadata: metadataTraslado(transfer, {
      accion: 'crear',
      estadoAnterior: null,
      estadoNuevo: 'borrador',
    }),
  };
}

function eventoTransicionTraslado(
  transfer: TransferRequest,
  event: TransferRequestEvent,
): MatriculaHistorialEvento {
  const fecha = fechaIso(event.createdAt);
  const transicion = `${event.estadoAnterior ?? '—'} → ${event.estadoNuevo}`;
  const motivo = event.motivo?.trim();
  const descripcionBase = `${transfer.codigo}: ${transfer.ieOrigenNombre} → ${transfer.ieDestinoNombre} (${transicion})`;
  const descripcion = motivo ? `${descripcionBase}. ${motivo}` : descripcionBase;

  return {
    id: `traslado-${transfer.id}-evt-${event.id}`,
    tipo: 'traslado',
    fecha,
    titulo: tituloAccionTraslado(event.accion),
    descripcion,
    actorNombre: event.actorNombre,
    actorRol: event.actorRol,
    metadata: metadataTraslado(transfer, {
      transferEventId: event.id,
      accion: event.accion,
      estadoAnterior: event.estadoAnterior,
      estadoNuevo: event.estadoNuevo,
      motivo: motivo || undefined,
      observacion: event.observacion?.trim() || undefined,
    }),
  };
}

/** Construye la línea de tiempo de traslados a partir de solicitudes y sus eventos. */
export function eventosHistorialDesdeTraslados(
  transfers: TransferRequest[],
  eventsByRequestId: Map<number, TransferRequestEvent[]>,
): MatriculaHistorialEvento[] {
  const eventos: MatriculaHistorialEvento[] = [];

  for (const transfer of transfers) {
    eventos.push(eventoCreacionTraslado(transfer));
    const eventosTraslado = [...(eventsByRequestId.get(transfer.id) ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const event of eventosTraslado) {
      eventos.push(eventoTransicionTraslado(transfer, event));
    }
  }

  return eventos;
}
