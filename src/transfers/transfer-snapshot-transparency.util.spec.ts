import {
  buildTransferSnapshotTransparency,
  compararPadronDestino,
  extraerVacanteAprobacion,
} from './transfer-snapshot-transparency.util';
import type { TransferRequest } from './entities/transfer-request.entity';

describe('transfer-snapshot-transparency.util', () => {
  const row = {
    createdAt: new Date('2026-03-01T12:00:00Z'),
    ieOrigenNombre: 'IE Origen',
    ieOrigenCodigoModular: '1111111',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
    ieDestinoNombre: 'IE Destino',
    ieDestinoCodigoModular: '2222222',
    ieDestinoUgel: 'UGEL 02',
    ieDestinoDre: 'DRE Lima',
  } as TransferRequest;

  it('detecta diferencias entre snapshot y padrón actual', () => {
    const result = compararPadronDestino(
      { nombre: 'IE Destino', codigoModular: '2222222', ugel: 'UGEL 02', dre: 'DRE Lima' },
      { nombre: 'IE Destino Actualizada', ugel: 'UGEL 03', dre: 'DRE Lima' } as never,
    );
    expect(result.difiereDelSnapshot).toBe(true);
    expect(result.camposDistintos).toEqual(['nombre', 'ugel']);
  });

  it('extrae vacante del evento de aprobación', () => {
    const vacante = extraerVacanteAprobacion([
      {
        accion: 'aprobar',
        createdAt: new Date('2026-03-05T10:00:00Z'),
        cambios: {
          nuevo: {
            vacante: {
              seccionAsignada: 'A',
              vacantesDisponibles: 2,
              vacantesEnSeccion: 3,
              grado: '3ro',
              nivel: 'Secundaria',
            },
          },
        },
      },
    ]);
    expect(vacante?.seccionAsignada).toBe('A');
    expect(vacante?.vacantesDisponibles).toBe(2);
  });

  it('arma bloque de transparencia completo', () => {
    const transparencia = buildTransferSnapshotTransparency(row, [], {
      nombre: 'IE Destino',
      codigoModular: '2222222',
      ugel: 'UGEL 02',
      dre: 'DRE Lima',
    } as never);
    expect(transparencia.datosCongeladosEn).toContain('2026-03-01');
    expect(transparencia.snapshot.ieOrigen.ugel).toBe('UGEL 01');
    expect(transparencia.padronDestinoActual?.encontrada).toBe(true);
  });
});
