import {
  resolveFechaRetroalimentacionWindow,
  validateFechaRetroalimentacion,
} from './enrollment-feedback.util';

describe('enrollment-feedback.util', () => {
  it('resuelve ventana de fechas', () => {
    const window = resolveFechaRetroalimentacionWindow({
      anioEscolar: 2026,
      hoy: '2026-09-10',
    });
    expect(window.fechaMax).toBe('2026-09-10');
  });

  it('acepta fecha válida', () => {
    const window = resolveFechaRetroalimentacionWindow({
      anioEscolar: 2026,
      hoy: '2026-09-10',
    });
    expect(validateFechaRetroalimentacion('2026-06-15', window)).toBeNull();
  });
});
