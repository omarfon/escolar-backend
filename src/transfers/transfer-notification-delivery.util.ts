import {
  MAX_REINTENTOS_NOTIFICACION,
  type CanalEntregaNotificacion,
  type EstadoEntregaNotificacion,
} from './transfer-notification.constants';
import type { TransferNotification } from './entities/transfer-notification.entity';
import type { MailSendResult } from '../mail/mail.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailDestinatarioValido(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? '';
  return !!value && EMAIL_REGEX.test(value);
}

/** Aplica el resultado de un intento SMTP sobre la notificación. */
export function aplicarIntentoCorreo(
  notification: TransferNotification,
  result: MailSendResult | null,
  errorMessage?: string,
): TransferNotification {
  notification.intentos += 1;

  if (!emailDestinatarioValido(notification.destinatarioEmail)) {
    notification.estadoEntrega = 'pendiente';
    notification.correoSimulado = false;
    notification.ultimoError =
      'Sin correo destinatario válido. La notificación queda disponible in-app.';
    return notification;
  }

  if (errorMessage) {
    return aplicarFalloCorreo(notification, errorMessage);
  }

  if (!result) {
    notification.estadoEntrega = 'pendiente';
    notification.correoSimulado = false;
    notification.ultimoError = 'No se obtuvo respuesta del servicio de correo.';
    return notification;
  }

  notification.correoSimulado = result.simulated;

  if (result.sent && !result.simulated) {
    notification.estadoEntrega = 'entregado';
    notification.canalEntrega = 'email';
    notification.correoMessageId = result.messageId ?? '';
    notification.entregadoAt = new Date();
    notification.ultimoError = '';
    return notification;
  }

  notification.estadoEntrega = 'pendiente';
  notification.canalEntrega = null;
  notification.correoMessageId = '';
  notification.ultimoError = result.simulated
    ? 'Correo no enviado (MAIL desactivado o sin transporte). Disponible in-app.'
    : 'Correo no confirmado. Disponible in-app.';
  return notification;
}

function aplicarFalloCorreo(
  notification: TransferNotification,
  errorMessage: string,
): TransferNotification {
  notification.ultimoError = errorMessage;
  if (notification.intentos >= notification.maxIntentos) {
    notification.estadoEntrega = 'fallido';
    return notification;
  }
  notification.estadoEntrega = 'pendiente';
  return notification;
}

/** Confirma entrega in-app al marcar como leída. */
export function marcarEntregaInApp(notification: TransferNotification): TransferNotification {
  if (notification.estadoEntrega !== 'entregado') {
    notification.estadoEntrega = 'entregado';
    notification.canalEntrega = 'in_app';
    notification.entregadoAt = notification.entregadoAt ?? new Date();
    if (!notification.ultimoError || notification.correoSimulado) {
      notification.ultimoError = '';
    }
  }
  return notification;
}

export function puedeReintentarEntrega(notification: TransferNotification): boolean {
  return (
    (notification.estadoEntrega === 'fallido' || notification.estadoEntrega === 'pendiente') &&
    notification.intentos < notification.maxIntentos &&
    emailDestinatarioValido(notification.destinatarioEmail)
  );
}

export function estadoEntregaLegible(estado: EstadoEntregaNotificacion): string {
  const map: Record<EstadoEntregaNotificacion, string> = {
    pendiente: 'Pendiente',
    enviado: 'Enviado',
    entregado: 'Entregado',
    fallido: 'Fallido',
  };
  return map[estado] ?? estado;
}

export function canalEntregaLegible(canal: CanalEntregaNotificacion | null | undefined): string {
  if (canal === 'email') return 'Correo electrónico';
  if (canal === 'in_app') return 'Bandeja in-app';
  return '';
}

export function valoresInicialesEntrega(): Pick<
  TransferNotification,
  | 'estadoEntrega'
  | 'intentos'
  | 'maxIntentos'
  | 'ultimoError'
  | 'entregadoAt'
  | 'leidoAt'
  | 'canalEntrega'
  | 'correoSimulado'
  | 'correoMessageId'
> {
  return {
    estadoEntrega: 'pendiente',
    intentos: 0,
    maxIntentos: MAX_REINTENTOS_NOTIFICACION,
    ultimoError: '',
    entregadoAt: null,
    leidoAt: null,
    canalEntrega: null,
    correoSimulado: false,
    correoMessageId: '',
  };
}
