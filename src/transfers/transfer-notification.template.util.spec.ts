import { planificarNotificacionesTraslado } from './transfer-notification.template.util';
import type { TransferRequest } from './entities/transfer-request.entity';

function row(partial: Partial<TransferRequest> = {}): TransferRequest {
  return {
    id: 10,
    codigo: 'TR-2026-0010',
    studentNombre: 'Ana Pérez',
    ieOrigenNombre: 'IE Origen',
    ieDestinoNombre: 'IE Destino',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
    ...partial,
  } as TransferRequest;
}

describe('planificarNotificacionesTraslado', () => {
  it('genera notificaciones para enviar con idempotencia única', () => {
    const planes = planificarNotificacionesTraslado(row(), 'enviar', 'borrador', 'enviada');
    expect(planes.length).toBe(3);
    expect(planes.map((p) => p.ambito)).toEqual(['IE_DESTINO', 'UGEL', 'DRE']);
    const keys = new Set(planes.map((p) => p.idempotencyKey));
    expect(keys.size).toBe(3);
    expect(planes[0].mensaje).toContain('TR-2026-0010');
    expect(planes[0].mensaje).not.toMatch(/\d{8}/);
  });

  it('notifica origen y ugel al aprobar', () => {
    const planes = planificarNotificacionesTraslado(row(), 'aprobar', 'enviada', 'aprobada');
    expect(planes.map((p) => p.plantilla)).toEqual([
      'traslado_aprobado_origen',
      'traslado_aprobado_ugel',
    ]);
  });

  it('notifica destino al cancelar desde enviada', () => {
    const planes = planificarNotificacionesTraslado(row(), 'cancelar', 'enviada', 'cancelada');
    expect(planes.some((p) => p.plantilla === 'traslado_cancelado_destino')).toBe(true);
  });
});
