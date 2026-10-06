import {
  aplicarIntentoCorreo,
  marcarEntregaInApp,
  puedeReintentarEntrega,
} from './transfer-notification-delivery.util';
import type { TransferNotification } from './entities/transfer-notification.entity';

function notification(partial: Partial<TransferNotification> = {}): TransferNotification {
  return {
    intentos: 0,
    maxIntentos: 3,
    estadoEntrega: 'pendiente',
    ultimoError: '',
    destinatarioEmail: 'user@ie.pe',
    ...partial,
  } as TransferNotification;
}

describe('aplicarIntentoCorreo', () => {
  it('marca entregado solo si el correo fue enviado de verdad', () => {
    const result = aplicarIntentoCorreo(notification(), {
      sent: true,
      simulated: false,
      messageId: 'msg-1',
    });
    expect(result.estadoEntrega).toBe('entregado');
    expect(result.canalEntrega).toBe('email');
    expect(result.correoMessageId).toBe('msg-1');
    expect(result.intentos).toBe(1);
  });

  it('deja pendiente si el correo fue simulado', () => {
    const result = aplicarIntentoCorreo(notification(), {
      sent: false,
      simulated: true,
    });
    expect(result.estadoEntrega).toBe('pendiente');
    expect(result.correoSimulado).toBe(true);
    expect(result.canalEntrega).toBeNull();
    expect(result.ultimoError).toContain('in-app');
  });

  it('marca fallido al agotar reintentos por error SMTP', () => {
    const base = notification({ intentos: 2, maxIntentos: 3 });
    const result = aplicarIntentoCorreo(base, null, 'SMTP timeout');
    expect(result.estadoEntrega).toBe('fallido');
    expect(puedeReintentarEntrega(result)).toBe(false);
  });

  it('permite reintento si aún hay intentos disponibles', () => {
    const result = aplicarIntentoCorreo(notification(), null, 'SMTP timeout');
    expect(result.estadoEntrega).toBe('pendiente');
    expect(puedeReintentarEntrega(result)).toBe(true);
  });
});

describe('marcarEntregaInApp', () => {
  it('confirma entrega in-app al leer', () => {
    const result = marcarEntregaInApp(notification());
    expect(result.estadoEntrega).toBe('entregado');
    expect(result.canalEntrega).toBe('in_app');
    expect(result.entregadoAt).toBeInstanceOf(Date);
  });
});
