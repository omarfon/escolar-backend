import type { AccionTraslado, EstadoTraslado } from './transfer.constants';

export type AmbitoNotificacionTraslado = 'IE_ORIGEN' | 'IE_DESTINO' | 'UGEL' | 'DRE' | 'MINEDU';

export type EstadoEntregaNotificacion = 'pendiente' | 'enviado' | 'entregado' | 'fallido';

export type CanalEntregaNotificacion = 'email' | 'in_app';

export const MAX_REINTENTOS_NOTIFICACION = 3;

export const PLANTILLAS_NOTIFICACION_TRASLADO = [
  'traslado_enviado_destino',
  'traslado_enviado_ugel',
  'traslado_enviado_dre',
  'traslado_cambio_estado_origen',
  'traslado_observado_origen',
  'traslado_aprobado_origen',
  'traslado_aprobado_ugel',
  'traslado_rechazado_origen',
  'traslado_rechazado_destino',
  'traslado_cancelado_destino',
  'traslado_concluido_origen',
  'traslado_concluido_destino',
  'traslado_concluido_ugel',
] as const;

export type PlantillaNotificacionTraslado = (typeof PLANTILLAS_NOTIFICACION_TRASLADO)[number];

export interface NotificacionTrasladoPlan {
  plantilla: PlantillaNotificacionTraslado;
  ambito: AmbitoNotificacionTraslado;
  mensaje: string;
  idempotencyKey: string;
}

export interface TransferNotificationContext {
  codigo: string;
  studentNombre: string;
  ieOrigenNombre: string;
  ieDestinoNombre: string;
  ieOrigenUgel: string;
  ieOrigenDre: string;
}

export function claveIdempotenciaNotificacion(
  transferRequestId: number,
  plantilla: PlantillaNotificacionTraslado,
  ambito: AmbitoNotificacionTraslado,
  accion: AccionTraslado | 'crear',
  estadoAnterior: EstadoTraslado | null,
  estadoNuevo: EstadoTraslado,
): string {
  return `${transferRequestId}:${accion}:${estadoAnterior ?? '—'}>${estadoNuevo}:${ambito}:${plantilla}`;
}
