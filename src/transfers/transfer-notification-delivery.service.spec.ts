import { TransferNotificationDeliveryService } from './transfer-notification-delivery.service';
import type { TransferNotification } from './entities/transfer-notification.entity';

describe('TransferNotificationDeliveryService', () => {
  const row = {
    codigo: 'TR-2026-0010',
    studentNombre: 'Ana Pérez',
    estado: 'enviada',
  };

  it('envía correo y marca entregado cuando SMTP confirma', async () => {
    const mailService = {
      sendTransferNotification: jest.fn(async () => ({
        sent: true,
        simulated: false,
        messageId: 'smtp-1',
      })),
    };
    const service = new TransferNotificationDeliveryService(mailService as never);
    const notification = {
      id: 1,
      destinatarioEmail: 'm.destino@ie.pe',
      mensaje: 'Traslado enviado',
      plantilla: 'traslado_enviado_destino',
      estadoNuevo: 'enviada',
      ambito: 'IE_DESTINO',
      estadoEntrega: 'pendiente',
      intentos: 0,
      maxIntentos: 3,
    } as TransferNotification;

    const result = await service.attemptEmailDelivery(notification, row);

    expect(mailService.sendTransferNotification).toHaveBeenCalled();
    expect(result.estadoEntrega).toBe('entregado');
    expect(result.canalEntrega).toBe('email');
  });

  it('deja pendiente si MAIL está desactivado', async () => {
    const mailService = {
      sendTransferNotification: jest.fn(async () => ({
        sent: false,
        simulated: true,
      })),
    };
    const service = new TransferNotificationDeliveryService(mailService as never);
    const notification = {
      destinatarioEmail: 'm.destino@ie.pe',
      mensaje: 'Traslado enviado',
      plantilla: 'traslado_enviado_destino',
      estadoNuevo: 'enviada',
      ambito: 'IE_DESTINO',
      estadoEntrega: 'pendiente',
      intentos: 0,
      maxIntentos: 3,
    } as TransferNotification;

    const result = await service.attemptEmailDelivery(notification, row);

    expect(result.estadoEntrega).toBe('pendiente');
    expect(result.correoSimulado).toBe(true);
  });
});
