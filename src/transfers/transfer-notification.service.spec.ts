import { BadRequestException } from '@nestjs/common';
import { TransferNotificationService } from './transfer-notification.service';
import type { TransferRequest } from './entities/transfer-request.entity';

describe('TransferNotificationService.dispatchInTransaction', () => {
  const row = {
    id: 10,
    codigo: 'TR-2026-0010',
    studentNombre: 'Ana Pérez',
    ieOrigenNombre: 'IE Origen',
    ieDestinoNombre: 'IE Destino',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
    ieOrigenCodigoModular: '1111111',
    ieDestinoCodigoModular: '2222222',
  } as TransferRequest;

  function buildService(
    recipientResolver: { resolveRecipients: jest.Mock },
    repo: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    },
  ) {
    return new TransferNotificationService(
      {} as never,
      { findOne: repo.findOne } as never,
      {} as never,
      {} as never,
      {} as never,
      recipientResolver as never,
      { attemptEmailDelivery: jest.fn(async (n) => n) } as never,
    );
  }

  it('crea una notificación por usuario resuelto con idempotencia por userId', async () => {
    const saved: object[] = [];
    const repo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => {
        saved.push(payload);
        return { id: saved.length, ...payload };
      }),
    };
    const recipientResolver = {
      resolveRecipients: jest.fn(async () => [
        {
          destinatarioTipo: 'usuario',
          destinatarioUserId: 7,
          destinatarioEmail: 'm.destino@ie.pe',
          destinatario: 'López, María (SECRETARIA)',
          destinatarioInstitutionId: 3,
          destinatarioAmbitoNivel: 'IE',
          destinatarioRol: 'SECRETARIA',
        },
      ]),
    };
    const service = buildService(recipientResolver, repo);
    const manager = { getRepository: () => repo };

    const result = await service.dispatchInTransaction(
      manager as never,
      row,
      'enviar',
      'borrador',
      'enviada',
    );

    expect(result).toHaveLength(3);
    expect(recipientResolver.resolveRecipients).toHaveBeenCalledTimes(3);
    expect(saved.every((n) => (n as { destinatarioUserId: number }).destinatarioUserId === 7)).toBe(
      true,
    );
    expect(
      saved.every((n) =>
        String((n as { idempotencyKey: string }).idempotencyKey).endsWith(':u7'),
      ),
    ).toBe(true);
    expect(saved.every((n) => (n as { estadoEntrega: string }).estadoEntrega === 'pendiente')).toBe(
      true,
    );
  });

  it('falla si no hay destinatarios resolubles', async () => {
    const repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const recipientResolver = {
      resolveRecipients: jest.fn(async () => []),
    };
    const service = buildService(recipientResolver, repo);
    const manager = { getRepository: () => repo };

    await expect(
      service.dispatchInTransaction(manager as never, row, 'enviar', 'borrador', 'enviada'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
