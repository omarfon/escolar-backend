import { BadRequestException } from '@nestjs/common';
import { GradingConfigDto } from './grading-config.types';

export interface NotaRangeBounds {
  min: number;
  max: number;
  notaMinimaAprobatoria: number;
}

export interface RangeValidationContext {
  min: number;
  max: number;
  notaMinimaAprobatoria: number;
  escalaLogro: { AD: number; A: number; B: number };
  mensaje: string;
  mensajeAprobacion: string;
}

export interface NotaRangeValidationResult {
  valid: boolean;
  nota: number;
  min: number;
  max: number;
  message?: string;
}

export function boundsFromConfig(config: GradingConfigDto): NotaRangeBounds {
  return {
    min: 0,
    max: config.notaMaxima,
    notaMinimaAprobatoria: config.notaMinima,
  };
}

export function buildRangeValidationContext(
  config: GradingConfigDto,
): RangeValidationContext {
  const bounds = boundsFromConfig(config);
  return {
    min: bounds.min,
    max: bounds.max,
    notaMinimaAprobatoria: bounds.notaMinimaAprobatoria,
    escalaLogro: config.escalaLogro,
    mensaje: `Las calificaciones deben estar entre ${bounds.min} y ${bounds.max}.`,
    mensajeAprobacion: `Nota mínima aprobatoria: ${bounds.notaMinimaAprobatoria}.`,
  };
}

export function validateNotaInRange(
  nota: number,
  bounds: Pick<NotaRangeBounds, 'min' | 'max'>,
): NotaRangeValidationResult {
  if (Number.isNaN(nota) || !Number.isFinite(nota)) {
    return {
      valid: false,
      nota,
      min: bounds.min,
      max: bounds.max,
      message: 'La nota debe ser un número válido.',
    };
  }
  if (nota < bounds.min || nota > bounds.max) {
    return {
      valid: false,
      nota,
      min: bounds.min,
      max: bounds.max,
      message: `La nota ${nota} está fuera del rango permitido (${bounds.min}–${bounds.max}).`,
    };
  }
  return { valid: true, nota, min: bounds.min, max: bounds.max };
}

export function assertNotaInRange(
  nota: number,
  bounds: Pick<NotaRangeBounds, 'min' | 'max'>,
): void {
  const result = validateNotaInRange(nota, bounds);
  if (!result.valid) {
    throw new BadRequestException(result.message);
  }
}
