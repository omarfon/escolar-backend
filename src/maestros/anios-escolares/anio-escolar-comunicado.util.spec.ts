import { construirComunicadoCalendario } from './anio-escolar-comunicado.util';

describe('construirComunicadoCalendario', () => {
  it('genera título y cuerpo con resumen del calendario', () => {
    const { titulo, cuerpo } = construirComunicadoCalendario({
      institutionNombre: 'I.E. San Juan',
      anio: 2026,
      fechaInicio: '2026-03-01',
      fechaFin: '2026-12-20',
      tipoPeriodo: 'bimestre',
      version: 1,
      periodos: [{ nombre: 'I Bimestre', inicio: '2026-03-01', fin: '2026-05-15' }],
      feriados: 3,
      eventos: 5,
    });

    expect(titulo).toContain('2026');
    expect(cuerpo).toContain('I Bimestre');
    expect(cuerpo).toContain('Feriados registrados: 3');
    expect(cuerpo).toContain('v2');
  });
});
