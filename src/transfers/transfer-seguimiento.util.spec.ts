import {
  construirEtapasSeguimiento,
  construirLineaTiempo,
  construirResumenSeguimiento,
  rolVisualizadorSeguimiento,
} from './transfer-seguimiento.util';

describe('transfer-seguimiento.util', () => {
  const baseEventos = [
    { id: 1, accion: 'crear', estadoAnterior: null, estadoNuevo: 'borrador', motivo: 'Motivo', actorNombre: 'A', createdAt: '2026-01-01T10:00:00Z' },
    { id: 2, accion: 'enviar', estadoAnterior: 'borrador', estadoNuevo: 'enviada', motivo: 'Envío', actorNombre: 'A', createdAt: '2026-01-02T10:00:00Z' },
  ];

  it('marca etapas completadas hasta envío', () => {
    const etapas = construirEtapasSeguimiento('enviada', baseEventos);
    expect(etapas[0].estado).toBe('completado');
    expect(etapas[1].estado).toBe('completado');
    expect(etapas[2].estado).toBe('en_curso');
    expect(etapas[1].fechaCompletado).toContain('2026-01-02');
  });

  it('marca revisión fallida al rechazar', () => {
    const etapas = construirEtapasSeguimiento('rechazada', [
      ...baseEventos,
      { accion: 'rechazar', createdAt: '2026-01-03T10:00:00Z' },
    ]);
    expect(etapas[2].estado).toBe('fallido');
    expect(etapas[3].estado).toBe('omitido');
    expect(etapas[4].estado).toBe('omitido');
  });

  it('ordena la línea de tiempo por fecha', () => {
    const linea = construirLineaTiempo({
      eventos: baseEventos.map((e) => ({ ...e, observacion: '' })),
      notificaciones: [
        {
          id: 1,
          mensaje: 'Aviso',
          ambito: 'IE_DESTINO',
          destinatario: 'dest@ie.pe',
          estadoEntrega: 'entregado',
          estadoAnterior: 'borrador',
          estadoNuevo: 'enviada',
          createdAt: '2026-01-02T11:00:00Z',
        },
      ],
      auditoria: [
        {
          id: 1,
          accion: 'actualizar',
          descripcion: 'Envió solicitud TR-2026-0001',
          usuarioNombre: 'Admin',
          resultado: 'success',
          detalle: null,
          createdAt: '2026-01-02T10:30:00Z',
        },
      ],
    });
    expect(linea).toHaveLength(4);
    expect(linea[0].tipo).toBe('evento');
    expect(linea[0].titulo).toContain('Creó');
    expect(linea.map((i) => i.id)).toEqual([
      'evento-1',
      'evento-2',
      'auditoria-1',
      'notificacion-1',
    ]);
  });

  it('calcula resumen con plazo vencido', () => {
    const resumen = construirResumenSeguimiento({
      estado: 'enviada',
      createdAt: '2020-01-01T00:00:00Z',
      plazoHasta: '2020-06-01',
      lineaTiempo: [],
    });
    expect(resumen.plazoVencido).toBe(true);
    expect(resumen.esTerminal).toBe(false);
    expect(resumen.diasEnProceso).toBeGreaterThan(100);
  });

  it('determina rol visualizador', () => {
    expect(rolVisualizadorSeguimiento('111', '111', '222', false)).toBe('origen');
    expect(rolVisualizadorSeguimiento('222', '111', '222', false)).toBe('destino');
    expect(rolVisualizadorSeguimiento('333', '111', '222', true)).toBe('territorial');
  });
});
