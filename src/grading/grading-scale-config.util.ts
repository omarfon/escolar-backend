import {
  EscalaLogroConfig,
  GradingConfigDto,
  SistemaEval,
  buildGradingConfig,
} from './grading-config.types';
import { CurriculumTipoEscala } from '../curricula/entities/curriculum.entity';

export type EscalaModalidad = 'cuantitativa' | 'cualitativa' | 'mixta';

export function modalidadFromSistemaEval(sistema: SistemaEval): EscalaModalidad {
  if (sistema === 'literal') return 'cualitativa';
  if (sistema === 'mixto') return 'mixta';
  return 'cuantitativa';
}

export function modalidadFromTipoEscala(tipo: CurriculumTipoEscala): EscalaModalidad {
  if (tipo === 'numerica') return 'cuantitativa';
  return 'cualitativa';
}

export function labelTipoEscala(tipo: CurriculumTipoEscala): string {
  const map: Record<CurriculumTipoEscala, string> = {
    numerica: 'Cuantitativa (0–20)',
    literal: 'Cualitativa (literal)',
    competencia: 'Cualitativa (competencias AD/A/B/C)',
  };
  return map[tipo] ?? tipo;
}

export function validateEscalaLogro(
  escala: EscalaLogroConfig,
  notaMinima: number,
): string | null {
  for (const [key, value] of Object.entries(escala)) {
    if (value < 0 || value > 20) {
      return `El umbral ${key} debe estar entre 0 y 20`;
    }
  }
  if (escala.AD <= escala.A) {
    return 'El umbral AD debe ser mayor que A';
  }
  if (escala.A <= escala.B) {
    return 'El umbral A debe ser mayor que B';
  }
  if (escala.B < notaMinima) {
    return 'El umbral B no puede ser menor que la nota mínima aprobatoria';
  }
  return null;
}

export function validateNotaMinima(notaMinima: number): string | null {
  if (notaMinima < 0 || notaMinima > 20) {
    return 'La nota mínima debe estar entre 0 y 20';
  }
  return null;
}

export function assertScaleConfig(input: {
  sistemaEval?: SistemaEval;
  tipoPeriodo?: string;
  notaMinima?: number;
  escalaLogro?: EscalaLogroConfig;
}): GradingConfigDto {
  const built = buildGradingConfig(input);
  const minError = validateNotaMinima(built.notaMinima);
  if (minError) throw new Error(minError);
  const escalaError = validateEscalaLogro(built.escalaLogro, built.notaMinima);
  if (escalaError) throw new Error(escalaError);
  return built;
}

export function snapshotInstitutionScale(row: {
  sistemaEval: string;
  tipoPeriodo: string;
  notaMinima: number;
  escalaLogro: EscalaLogroConfig;
}): Record<string, unknown> {
  return {
    sistemaEval: row.sistemaEval,
    tipoPeriodo: row.tipoPeriodo,
    notaMinima: row.notaMinima,
    escalaLogro: { ...row.escalaLogro },
  };
}
