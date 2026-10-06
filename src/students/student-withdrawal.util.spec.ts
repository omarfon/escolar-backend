import {
  resolveFechaRetiroWindow,
  validateFechaRetiro,
} from './student-withdrawal.util';

describe('student-withdrawal.util', () => {
  it('impide fecha anterior a la matrícula', () => {
    const window = resolveFechaRetiroWindow({
      anioEscolar: 2026,
      anioIngreso: '2026',
      periodoInicio: '2026-03-01',
      periodoFin: '2026-12-15',
      hoy: '2026-09-28',
    });
    expect(window.fechaMin).toBe('2026-03-01');
    expect(validateFechaRetiro('2026-02-01', window)).toContain('anterior');
  });

  it('impide fecha posterior al periodo permitido', () => {
    const window = resolveFechaRetiroWindow({
      anioEscolar: 2026,
      anioIngreso: '2025',
      periodoInicio: '2026-03-01',
      periodoFin: '2026-12-15',
      hoy: '2026-09-28',
    });
    expect(window.fechaMax).toBe('2026-09-28');
    expect(validateFechaRetiro('2026-10-01', window)).toContain('posterior');
  });

  it('acepta fecha dentro de la ventana', () => {
    const window = resolveFechaRetiroWindow({
      anioEscolar: 2026,
      anioIngreso: '2026',
      periodoInicio: '2026-03-01',
      periodoFin: '2026-12-15',
      hoy: '2026-09-28',
    });
    expect(validateFechaRetiro('2026-09-10', window)).toBeNull();
  });

  it('rechaza formato inválido', () => {
    const window = { fechaMin: '2026-03-01', fechaMax: '2026-09-28' };
    expect(validateFechaRetiro('28/09/2026', window)).toContain('formato');
  });
});
