import {
  anioDeFechaIso,
  construirMensajeCopiaCalendario,
  desplazarFechaIso,
  fechaEnRangoAnioEscolar,
  periodoSolapaExistentes,
} from './anio-escolar-calendario-copy.util';

describe('anio-escolar-calendario-copy.util', () => {
  it('desplaza fechas un año', () => {
    expect(desplazarFechaIso('2025-07-28', 1)).toBe('2026-07-28');
    expect(desplazarFechaIso('2025-03-10', 1)).toBe('2026-03-10');
  });

  it('rechaza fechas inválidas', () => {
    expect(desplazarFechaIso('invalid', 1)).toBeNull();
    expect(desplazarFechaIso('2025-02-30', 1)).toBeNull();
  });

  it('valida rango dentro del año escolar', () => {
    expect(fechaEnRangoAnioEscolar('2026-03-01', '2026-03-01', '2026-12-20')).toBe(true);
    expect(fechaEnRangoAnioEscolar('2026-02-28', '2026-03-01', '2026-12-20')).toBe(false);
    expect(fechaEnRangoAnioEscolar('2027-01-01', '2026-03-01', '2026-12-20')).toBe(false);
  });

  it('extrae año de fecha ISO', () => {
    expect(anioDeFechaIso('2025-05-12')).toBe(2025);
    expect(anioDeFechaIso('bad')).toBeNull();
  });

  it('detecta solapamiento de periodos', () => {
    const existentes = [{ numero: 1, inicio: '2026-03-10', fin: '2026-05-09' }];
    expect(
      periodoSolapaExistentes({ numero: 2, inicio: '2026-05-01', fin: '2026-07-25' }, existentes),
    ).toBe(true);
    expect(
      periodoSolapaExistentes({ numero: 2, inicio: '2026-05-10', fin: '2026-07-25' }, existentes),
    ).toBe(false);
  });

  it('construye mensaje de resultado', () => {
    const msg = construirMensajeCopiaCalendario({
      anioDestino: 2027,
      anioOrigen: 2026,
      deltaAnios: 1,
      periodos: { copiados: 4, omitidos: 0, fueraDeRango: 0 },
      feriados: { copiados: 2, omitidos: 1, fueraDeRango: 0 },
      eventos: { copiados: 0, omitidos: 0, fueraDeRango: 0 },
      version: 2,
    });
    expect(msg).toContain('2026');
    expect(msg).toContain('2027');
  });
});
