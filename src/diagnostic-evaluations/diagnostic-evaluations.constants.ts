/** Bimestre oficial de evaluación diagnóstica (adaptación inicial). */
export const DIAGNOSTIC_BIMESTRE = 1;

export const NIVELES_LOGRO_DIAGNOSTICO = ['AD', 'A', 'B', 'C'] as const;
export type NivelLogroDiagnostico = (typeof NIVELES_LOGRO_DIAGNOSTICO)[number];

export function isNivelLogroDiagnostico(
  value: string,
): value is NivelLogroDiagnostico {
  return (NIVELES_LOGRO_DIAGNOSTICO as readonly string[]).includes(value);
}
