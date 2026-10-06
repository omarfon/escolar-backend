import { BadRequestException } from '@nestjs/common';
import { DEFAULT_GRADING_CONFIG } from './grading-config.types';
import {
  assertNotaInRange,
  boundsFromConfig,
  buildRangeValidationContext,
  validateNotaInRange,
} from './grading-range.util';

describe('grading-range.util', () => {
  const bounds = boundsFromConfig(DEFAULT_GRADING_CONFIG);

  it('acepta notas dentro del rango 0–20', () => {
    expect(validateNotaInRange(0, bounds).valid).toBe(true);
    expect(validateNotaInRange(20, bounds).valid).toBe(true);
    expect(validateNotaInRange(15.5, bounds).valid).toBe(true);
  });

  it('rechaza notas fuera de rango', () => {
    const low = validateNotaInRange(-1, bounds);
    const high = validateNotaInRange(21, bounds);
    expect(low.valid).toBe(false);
    expect(high.valid).toBe(false);
    expect(high.message).toContain('21');
    expect(high.message).toContain('0–20');
  });

  it('assertNotaInRange lanza BadRequestException', () => {
    expect(() => assertNotaInRange(25, bounds)).toThrow(BadRequestException);
  });

  it('buildRangeValidationContext expone mensajes institucionales', () => {
    const ctx = buildRangeValidationContext(DEFAULT_GRADING_CONFIG);
    expect(ctx.min).toBe(0);
    expect(ctx.max).toBe(20);
    expect(ctx.notaMinimaAprobatoria).toBe(11);
    expect(ctx.mensaje).toContain('0');
    expect(ctx.mensaje).toContain('20');
  });
});
