import {
  calcularEdadEnCorte,
  edadNormativaEsperada,
  validarEdadNormativa,
} from './enrollment-age.util';

describe('enrollment-age.util', () => {
  it('calcula edad al 31/03 del año escolar', () => {
    expect(calcularEdadEnCorte('2018-04-01', 2026)).toBe(7);
    expect(calcularEdadEnCorte('2018-03-31', 2026)).toBe(8);
    expect(calcularEdadEnCorte('2018-03-30', 2026)).toBe(8);
  });

  it('resuelve edad normativa por nivel y grado', () => {
    expect(edadNormativaEsperada('Inicial', '1°')).toBe(3);
    expect(edadNormativaEsperada('Primaria', '2°')).toBe(7);
    expect(edadNormativaEsperada('Secundaria', '1°')).toBe(12);
  });

  it('valida edad normativa estricta', () => {
    const ok = validarEdadNormativa({
      fechaNac: '2018-04-01',
      nivel: 'Primaria',
      grado: '2°',
      anioEscolar: 2026,
    });
    expect(ok.valido).toBe(true);
    expect(ok.edadActual).toBe(7);
    expect(ok.edadEsperada).toBe(7);

    const fail = validarEdadNormativa({
      fechaNac: '2010-01-01',
      nivel: 'Primaria',
      grado: '2°',
      anioEscolar: 2026,
    });
    expect(fail.valido).toBe(false);
    expect(fail.mensaje).toContain('16 años');
  });
});
