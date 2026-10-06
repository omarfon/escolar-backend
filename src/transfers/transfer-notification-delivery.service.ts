import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import type { TransferNotification } from './entities/transfer-notification.entity';
import type { TransferRequest } from './entities/transfer-request.entity';
import {
  aplicarIntentoCorreo,
  emailDestinatarioValido,
} from './transfer-notification-delivery.util';

@Injectable()
export class TransferNotificationDeliveryService {
  private readonly logger = new Logger(TransferNotificationDeliveryService.name);

  constructor(private readonly mailService: MailService) {}

  async attemptEmailDelivery(
    notification: TransferNotification,
    row: Pick<TransferRequest, 'codigo' | 'studentNombre' | 'estado'>,
  ): Promise<TransferNotification> {
    if (notification.estadoEntrega === 'entregado') {
      return notification;
    }

    const to = notification.destinatarioEmail?.trim() ?? '';
    if (!emailDestinatarioValido(to)) {
      return aplicarIntentoCorreo(notification, null);
    }

    try {
      const result = await this.mailService.sendTransferNotification({
        to,
        codigo: row.codigo,
        studentNombre: row.studentNombre,
        mensaje: notification.mensaje,
        plantilla: notification.plantilla,
        estadoNuevo: notification.estadoNuevo || row.estado,
        ambito: notification.ambito,
      });
      return aplicarIntentoCorreo(notification, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar correo';
      this.logger.warn(
        `Fallo SMTP notificación traslado ${notification.id ?? 'nueva'} (${row.codigo}): ${message}`,
      );
      return aplicarIntentoCorreo(notification, null, message);
    }
  }
}
