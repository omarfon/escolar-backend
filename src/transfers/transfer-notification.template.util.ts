import type { AccionTraslado, EstadoTraslado } from './transfer.constants';
import type { TransferRequest } from './entities/transfer-request.entity';
import {
  NotificacionTrasladoPlan,
  TransferNotificationContext,
  claveIdempotenciaNotificacion,
} from './transfer-notification.constants';

function ctx(row: TransferRequest): TransferNotificationContext {
  return {
    codigo: row.codigo,
    studentNombre: row.studentNombre,
    ieOrigenNombre: row.ieOrigenNombre,
    ieDestinoNombre: row.ieDestinoNombre,
    ieOrigenUgel: row.ieOrigenUgel,
    ieOrigenDre: row.ieOrigenDre,
  };
}

function plan(
  row: TransferRequest,
  accion: AccionTraslado | 'crear',
  estadoAnterior: EstadoTraslado | null,
  estadoNuevo: EstadoTraslado,
  item: Omit<NotificacionTrasladoPlan, 'idempotencyKey'>,
): NotificacionTrasladoPlan {
  return {
    ...item,
    idempotencyKey: claveIdempotenciaNotificacion(
      row.id,
      item.plantilla,
      item.ambito,
      accion,
      estadoAnterior,
      estadoNuevo,
    ),
  };
}

/** Genera planes de notificación por transición de estado (sin datos sensibles). */
export function planificarNotificacionesTraslado(
  row: TransferRequest,
  accion: AccionTraslado | 'crear',
  estadoAnterior: EstadoTraslado | null,
  estadoNuevo: EstadoTraslado,
): NotificacionTrasladoPlan[] {
  const c = ctx(row);
  const planes: NotificacionTrasladoPlan[] = [];

  if (accion === 'enviar') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_enviado_destino',
        ambito: 'IE_DESTINO',
        mensaje: `${c.codigo}: la IE ${c.ieOrigenNombre} envió el traslado de ${c.studentNombre}. Revise y resuelva en el plazo indicado.`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_enviado_ugel',
        ambito: 'UGEL',
        mensaje: `${c.codigo}: solicitud de traslado enviada para ${c.studentNombre} (${c.ieOrigenNombre} → ${c.ieDestinoNombre}).`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_enviado_dre',
        ambito: 'DRE',
        mensaje: `${c.codigo}: solicitud de traslado enviada para ${c.studentNombre}.`,
      }),
    );
    return planes;
  }

  if (accion === 'observar') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_observado_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: la solicitud fue observada y requiere subsanar documentación antes de continuar.`,
      }),
    );
    return planes;
  }

  if (accion === 'aprobar') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_aprobado_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: el traslado de ${c.studentNombre} fue aprobado por la IE ${c.ieDestinoNombre}.`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_aprobado_ugel',
        ambito: 'UGEL',
        mensaje: `${c.codigo}: traslado aprobado (${c.ieOrigenNombre} → ${c.ieDestinoNombre}).`,
      }),
    );
    return planes;
  }

  if (accion === 'rechazar') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_rechazado_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: el traslado de ${c.studentNombre} fue rechazado. Consulte el historial para el motivo registrado.`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_rechazado_destino',
        ambito: 'IE_DESTINO',
        mensaje: `${c.codigo}: se registró el rechazo del traslado de ${c.studentNombre}.`,
      }),
    );
    return planes;
  }

  if (accion === 'cancelar') {
    if (estadoAnterior === 'enviada' || estadoAnterior === 'observada') {
      planes.push(
        plan(row, accion, estadoAnterior, estadoNuevo, {
          plantilla: 'traslado_cancelado_destino',
          ambito: 'IE_DESTINO',
          mensaje: `${c.codigo}: la IE ${c.ieOrigenNombre} canceló la solicitud de traslado.`,
        }),
      );
    }
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_cambio_estado_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: la solicitud pasó a ${estadoNuevo}.`,
      }),
    );
    return planes;
  }

  if (accion === 'concluir') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_concluido_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: el traslado de ${c.studentNombre} fue concluido. La matrícula en origen quedó cerrada.`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_concluido_destino',
        ambito: 'IE_DESTINO',
        mensaje: `${c.codigo}: traslado concluido. El estudiante ${c.studentNombre} quedó matriculado en esta IE.`,
      }),
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_concluido_ugel',
        ambito: 'UGEL',
        mensaje: `${c.codigo}: traslado concluido (${c.ieOrigenNombre} → ${c.ieDestinoNombre}).`,
      }),
    );
    return planes;
  }

  if (accion !== 'crear') {
    planes.push(
      plan(row, accion, estadoAnterior, estadoNuevo, {
        plantilla: 'traslado_cambio_estado_origen',
        ambito: 'IE_ORIGEN',
        mensaje: `${c.codigo}: la solicitud pasó a ${estadoNuevo}.`,
      }),
    );
  }

  return planes;
}
