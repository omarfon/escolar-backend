import {
  FormulaComponente,
  FormulaEscalaLogro,
} from './entities/maestro-formula-evaluacion.entity';

const DEFAULT_ESCALA: FormulaEscalaLogro = { AD: 17.5, A: 14, B: 11 };

export function normalizeComponentes(
  componentes: FormulaComponente[],
): FormulaComponente[] {
  return [...componentes]
    .filter((c) => c.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((c, index) => ({
      codigo: c.codigo.trim(),
      nombre: c.nombre.trim(),
      peso: Number(c.peso),
      orden: c.orden ?? index + 1,
      activo: c.activo !== false,
    }));
}

export function validateComponentes(componentes: FormulaComponente[]): string | null {
  const items = normalizeComponentes(componentes);
  if (!items.length) return 'Debe definir al menos un componente de evaluación';
  const codigos = new Set<string>();
  for (const item of items) {
    if (!item.codigo) return 'Cada componente debe tener un código';
    if (!item.nombre) return 'Cada componente debe tener un nombre';
    if (item.peso <= 0 || item.peso > 100) {
      return 'Cada peso debe estar entre 1 y 100';
    }
    if (codigos.has(item.codigo)) {
      return `Código duplicado: ${item.codigo}`;
    }
    codigos.add(item.codigo);
  }
  const totalPeso = items.reduce((sum, c) => sum + c.peso, 0);
  if (Math.abs(totalPeso - 100) > 0.01) {
    return `Los pesos deben sumar 100 (actual: ${totalPeso})`;
  }
  return null;
}

export function calcNotaPonderada(
  componentes: FormulaComponente[],
  notas: Record<string, number | null | undefined>,
): number | null {
  const items = normalizeComponentes(componentes);
  if (!items.length) return null;

  let weighted = 0;
  for (const item of items) {
    const value = notas[item.codigo];
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    weighted += value * (item.peso / 100);
  }

  return round1(weighted);
}

export function nivelFromNota(
  nota: number,
  escala: FormulaEscalaLogro = DEFAULT_ESCALA,
): string {
  if (nota >= escala.AD) return 'AD';
  if (nota >= escala.A) return 'A';
  if (nota >= escala.B) return 'B';
  return 'C';
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
