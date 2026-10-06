import type { TransferRequestEvent } from '../transfers/entities/transfer-request-event.entity';
import type { TransferRequest } from '../transfers/entities/transfer-request.entity';
import {
  eventosHistorialDesdeTraslados,
  trasladoVisibleEnHistorial,
} from './enrollment-history-traslado.util';

function transfer(partial: Partial<TransferRequest> = {}): TransferRequest {
  return {
    id: 5,
    codigo: 'TR-2026-0005',
    studentId: 9,
    anioEscolar: 2026,
    estado: 'enviada',
    ieOrigenNombre: 'IE Origen',
    ieDestinoNombre: 'IE Destino',
    ieOrigenCodigoModular: '0654321',
    ieDestinoCodigoModular: '7654321',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
    actorNombre: 'Secretaría Origen',
    actorRol: 'SECRETARIA',
    createdAt: new Date('2026-03-01'),
    ...partial,
  } as TransferRequest;
}

describe('trasladoVisibleEnHistorial', () => {
  it('permite a la IE de origen ver el traslado en borrador', () => {
    expect(
      trasladoVisibleEnHistorial(
        transfer({ estado: 'borrador' }),
        { codigoModular: '0654321' },
        { esAdmin: false, ambitos: ['IE'] },
      ),
    ).toBe(true);
  });

  it('oculta borrador a la IE de destino', () => {
    expect(
      trasladoVisibleEnHistorial(
        transfer({ estado: 'borrador' }),
        { codigoModular: '7654321' },
        { esAdmin: false, ambitos: ['IE'] },
      ),
    ).toBe(false);
  });

  it('permite a destino ver traslado enviado', () => {
    expect(
      trasladoVisibleEnHistorial(
        transfer({ estado: 'enviada' }),
        { codigoModular: '7654321' },
        { esAdmin: false, ambitos: ['IE'] },
      ),
    ).toBe(true);
  });
});

describe('eventosHistorialDesdeTraslados', () => {
  it('genera creación y transiciones ordenadas', () => {
    const t = transfer();
    const events = new Map<number, TransferRequestEvent[]>([
      [
        5,
        [
          {
            id: 11,
            transferRequestId: 5,
            accion: 'enviar',
            estadoAnterior: 'borrador',
            estadoNuevo: 'enviada',
            motivo: 'Envío documentado',
            observacion: '',
            actorNombre: 'Sec Origen',
            actorRol: 'SECRETARIA',
            createdAt: new Date('2026-03-02'),
          } as TransferRequestEvent,
        ],
      ],
    ]);

    const eventos = eventosHistorialDesdeTraslados([t], events);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].id).toBe('traslado-5-creacion');
    expect(eventos[1].titulo).toContain('Envió');
    expect(eventos[1].metadata?.accion).toBe('enviar');
    expect(eventos[1].descripcion).toContain('Envío documentado');
  });
});
