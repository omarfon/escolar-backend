import { Grade } from './entities/grade.entity';

export function snapshotGrade(grade: Grade): Record<string, unknown> {
  return {
    nota: roundNota(grade.nota),
    componenteCodigo: grade.componenteCodigo,
    curso: grade.curso,
    bimestre: grade.bimestre,
    fechaEvaluacion: grade.fechaEvaluacion,
    tipo: grade.tipo,
    descripcion: grade.descripcion ?? '',
  };
}

export function diffGradeSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { anterior?: unknown; nuevo?: unknown }> | null {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const cambios: Record<string, { anterior?: unknown; nuevo?: unknown }> = {};

  for (const key of keys) {
    const prev = before?.[key];
    const next = after?.[key];
    if (stableJson(prev) === stableJson(next)) continue;
    cambios[key] = {};
    if (before) cambios[key].anterior = prev;
    if (after) cambios[key].nuevo = next;
  }

  return Object.keys(cambios).length ? cambios : null;
}

function roundNota(nota: number): number {
  return Math.round(nota * 100) / 100;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
