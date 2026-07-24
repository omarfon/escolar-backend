export type SistemaEval = 'numerico' | 'literal' | 'mixto';
export type TipoPeriodo = 'bimestre' | 'trimestre' | 'semestre';

export interface EscalaLogroConfig {
  AD: number;
  A: number;
  B: number;
}

export interface GradingConfigDto {
  sistemaEval: SistemaEval;
  tipoPeriodo: TipoPeriodo;
  notaMinima: number;
  notaMaxima: number;
  escalaLogro: EscalaLogroConfig;
  usesNumeric: boolean;
  usesCompetencias: boolean;
  periodosCount: number;
}

export const DEFAULT_ESCALA_LOGRO: EscalaLogroConfig = { AD: 17.5, A: 14, B: 11 };

export const DEFAULT_GRADING_CONFIG: GradingConfigDto = {
  sistemaEval: 'numerico',
  tipoPeriodo: 'bimestre',
  notaMinima: 11,
  notaMaxima: 20,
  escalaLogro: DEFAULT_ESCALA_LOGRO,
  usesNumeric: true,
  usesCompetencias: false,
  periodosCount: 4,
};

export function buildGradingConfig(input: {
  sistemaEval?: string | null;
  tipoPeriodo?: string | null;
  notaMinima?: number | null;
  escalaLogro?: Partial<EscalaLogroConfig> | null;
}): GradingConfigDto {
  const sistemaEval = normalizeSistemaEval(input.sistemaEval);
  const tipoPeriodo = normalizeTipoPeriodo(input.tipoPeriodo);
  const notaMinima = input.notaMinima ?? DEFAULT_GRADING_CONFIG.notaMinima;
  const escalaLogro: EscalaLogroConfig = {
    AD: input.escalaLogro?.AD ?? DEFAULT_ESCALA_LOGRO.AD,
    A: input.escalaLogro?.A ?? DEFAULT_ESCALA_LOGRO.A,
    B: input.escalaLogro?.B ?? notaMinima,
  };

  return {
    sistemaEval,
    tipoPeriodo,
    notaMinima,
    notaMaxima: 20,
    escalaLogro,
    usesNumeric: sistemaEval === 'numerico' || sistemaEval === 'mixto',
    usesCompetencias: sistemaEval === 'literal' || sistemaEval === 'mixto',
    periodosCount: periodosCountFromTipo(tipoPeriodo),
  };
}

export function normalizeSistemaEval(value?: string | null): SistemaEval {
  if (value === 'literal' || value === 'mixto') return value;
  return 'numerico';
}

export function normalizeTipoPeriodo(value?: string | null): TipoPeriodo {
  if (value === 'trimestre' || value === 'semestre') return value;
  return 'bimestre';
}

export function periodosCountFromTipo(tipo: TipoPeriodo): number {
  if (tipo === 'trimestre') return 3;
  if (tipo === 'semestre') return 2;
  return 4;
}

export function nivelFromNotaConfig(
  nota: number,
  escala: EscalaLogroConfig = DEFAULT_ESCALA_LOGRO,
): string {
  if (nota >= escala.AD) return 'AD';
  if (nota >= escala.A) return 'A';
  if (nota >= escala.B) return 'B';
  return 'C';
}

export function aprobadoPorNota(nota: number, notaMinima: number): boolean {
  return nota >= notaMinima;
}
