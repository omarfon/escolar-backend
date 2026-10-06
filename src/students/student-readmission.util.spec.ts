import {
  resolveFechaReingresoContextWindow,
  resolveFechaReingresoWindow,
  validateFechaReingreso,
} from './student-readmission.util';

describe('student-readmission.util', () => {
  it('resolveFechaReingresoWindow usa fecha de retiro como mínimo', () => {
    const window = resolveFechaReingresoWindow({
      fechaRetiro: '2026-06-15',
      anioEscolar: 2026,
      periodoFin: '2026-12-15',
      hoy: '2026-09-20',
    });
    expect(window.fechaMin).toBe('2026-06-15');
    expect(window.fechaMax).toBe('2026-09-20');
  });

  it('validateFechaReingreso rechaza fecha anterior al retiro', () => {
    const window = resolveFechaReingresoWindow({
      fechaRetiro: '2026-06-15',
      anioEscolar: 2026,
      hoy: '2026-09-20',
    });
    expect(validateFechaReingreso('2026-06-01', window)).toContain('anterior');
  });

  it('validateFechaReingreso acepta fecha dentro de ventana', () => {
    const window = resolveFechaReingresoWindow({
      fechaRetiro: '2026-06-15',
      anioEscolar: 2026,
      hoy: '2026-09-20',
    });
    expect(validateFechaReingreso('2026-09-10', window)).toBeNull();
  });

  it('resolveFechaReingresoContextWindow expone ventana del periodo', () => {
    const window = resolveFechaReingresoContextWindow({
      anioEscolar: 2026,
      periodoInicio: '2026-03-01',
      periodoFin: '2026-12-15',
      hoy: '2026-09-20',
    });
    expect(window.fechaMin).toBe('2026-03-01');
    expect(window.fechaMax).toBe('2026-09-20');
  });
});
