import { TransferRecipientResolverService } from './transfer-recipient-resolver.service';
import type { TransferRequest } from './entities/transfer-request.entity';

describe('TransferRecipientResolverService', () => {
  const row = {
    ieOrigenInstitutionId: 1,
    ieOrigenCodigoModular: '0654321',
    ieDestinoInstitutionId: 3,
    ieDestinoCodigoModular: '7654321',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
  } as TransferRequest;

  it('resuelve usuarios IE destino con permiso aprobar_destino', async () => {
    const dataSource = {
      query: jest.fn(async () => [
        {
          userId: 7,
          nombres: 'María',
          apellidos: 'López',
          email: 'm.destino@ie.pe',
          roleCodigo: 'SECRETARIA',
          assignmentAmbito: 'IE',
          institutionId: 3,
        },
      ]),
    };
    const institutionRepo = { findOneBy: jest.fn() };
    const service = new TransferRecipientResolverService(
      dataSource as never,
      institutionRepo as never,
    );

    const recipients = await service.resolveRecipients(row, 'IE_DESTINO');

    expect(recipients).toHaveLength(1);
    expect(recipients[0].destinatarioUserId).toBe(7);
    expect(recipients[0].destinatarioEmail).toBe('m.destino@ie.pe');
    expect(recipients[0].destinatario).toContain('SECRETARIA');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('permissions p'),
      expect.arrayContaining(['traslados.aprobar_destino', 3]),
    );
  });
});
