/** Combos nivel/grado/sección/curso/bimestre usados en la demo del registro de notas. */
export interface RegistroNotasComboSeed {
  nivel: string;
  grado: string;
  seccion: string;
  curso: string;
  bimestre: number;
}

export const REGISTRO_NOTAS_COMPONENTES = [
  { codigo: 'examen_parcial', tipo: 'partial' as const, dia: '10' },
  { codigo: 'examen_final', tipo: 'final' as const, dia: '22' },
  { codigo: 'trabajo_exposicion', tipo: 'daily' as const, dia: '05' },
] as const;

export const REGISTRO_NOTAS_DEMO_COMBOS: RegistroNotasComboSeed[] = [
  { nivel: 'Primaria', grado: '5°', seccion: 'A', curso: 'Matemática', bimestre: 2 },
  { nivel: 'Primaria', grado: '5°', seccion: 'A', curso: 'Comprensión Lectora', bimestre: 2 },
  { nivel: 'Primaria', grado: '5°', seccion: 'A', curso: 'Ciencia y Tecnología', bimestre: 2 },
  { nivel: 'Primaria', grado: '5°', seccion: 'A', curso: 'Inglés', bimestre: 2 },
  { nivel: 'Primaria', grado: '5°', seccion: 'A', curso: 'Matemática', bimestre: 1 },
  { nivel: 'Primaria', grado: '5°', seccion: 'B', curso: 'Matemática', bimestre: 2 },
  { nivel: 'Primaria', grado: '5°', seccion: 'B', curso: 'Comprensión Lectora', bimestre: 2 },
  { nivel: 'Primaria', grado: '4°', seccion: 'A', curso: 'Matemática', bimestre: 2 },
  { nivel: 'Secundaria', grado: '2°', seccion: 'A', curso: 'Comunicación', bimestre: 2 },
  { nivel: 'Secundaria', grado: '2°', seccion: 'A', curso: 'Aritmética', bimestre: 2 },
  { nivel: 'Secundaria', grado: '2°', seccion: 'A', curso: 'CTA', bimestre: 2 },
  { nivel: 'Secundaria', grado: '2°', seccion: 'B', curso: 'Comunicación', bimestre: 2 },
];

const BIMESTRE_MES: Record<number, string> = {
  1: '04',
  2: '06',
  3: '09',
  4: '11',
};

export function registroNotasFechaEvaluacion(bimestre: number, dia: string): string {
  const mes = BIMESTRE_MES[bimestre] ?? '06';
  return `2026-${mes}-${dia}`;
}

/** Nota determinística 10–18 según alumno, componente y curso. */
export function registroNotasDemoNota(
  studentId: number,
  bimestre: number,
  compIdx: number,
  curso: string,
): number {
  const raw =
    10 +
    ((studentId * 13 + bimestre * 7 + compIdx * 11 + curso.length * 3) % 9);
  return Math.round(raw * 10) / 10;
}

/** Algunos alumnos quedan con componentes vacíos para probar promedio parcial. */
export function registroNotasOmitirComponente(
  studentId: number,
  compIdx: number,
): boolean {
  return (studentId + compIdx * 3) % 7 === 0;
}
