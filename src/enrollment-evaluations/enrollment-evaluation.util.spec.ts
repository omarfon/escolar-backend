import {
  resolveFechaEvaluacionWindow,
  validateFechaEvaluacion,
} from './enrollment-evaluation.util';

describe('enrollment-evaluation.util', () => {
  it('resuelve ventana de fechas del año escolar', () => {
    const window = resolveFechaEvaluacionWindow({
      anioEscolar: 2026,
      periodoInicio: '2026-03-01',
      periodoFin: '2026-12-15',
      hoy: '2026-09-10',
    });
    expect(window.fechaMin).toBe('2026-03-01');
    expect(window.fechaMax).toBe('2026-09-10');
  });

  it('rechaza fecha fuera de ventana', () => {
    const window = resolveFechaEvaluacionWindow({
      anioEscolar: 2026,
      hoy: '2026-09-10',
    });
    expect(validateFechaEvaluacion('2025-12-31', window)).toContain(
      'no puede ser anterior',
    );
    expect(validateFechaEvaluacion('2027-01-01', window)).toContain(
      'no puede ser posterior',
    );
  });

  it('acepta fecha válida', () => {
    const window = resolveFechaEvaluacionWindow({
      anioEscolar: 2026,
      hoy: '2026-09-10',
    });
    expect(validateFechaEvaluacion('2026-06-15', window)).toBeNull();
  });
});
