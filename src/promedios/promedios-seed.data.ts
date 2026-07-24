/** Cursos numéricos y áreas de competencias para promedios demo — Primaria 5° A/B */
export const PROMEDIOS_CURSOS_NUMERICOS = [
  'Matemática',
  'Comprensión Lectora',
  'Ciencia y Tecnología',
  'Inglés',
] as const;

export const PROMEDIOS_AREAS_COMPETENCIA = [
  'Matemática',
  'Comunicación',
  'Ciencia y Tecnología',
  'Personal Social',
  'Inglés',
] as const;

export const PROMEDIOS_NIVELES: Array<'AD' | 'A' | 'B' | 'C'> = ['AD', 'A', 'B', 'C'];

export interface PromedioSeedRow {
  studentId: number;
  curso: string;
  tipo: 'numerico' | 'competencia';
  bimestre: number;
  anio: number;
  valorNumerico: number | null;
  nivelLogro: 'AD' | 'A' | 'B' | 'C' | null;
}

/** Genera filas de promedios variadas por alumno (determinístico según id). */
export function buildPromediosSeedRows(
  studentIds: number[],
  anio: number,
  bimestres: number[] = [1, 2],
): PromedioSeedRow[] {
  const rows: PromedioSeedRow[] = [];

  for (const studentId of studentIds) {
    const base = 10 + (studentId % 7);

    for (const bimestre of bimestres) {
      const offset = bimestre * 0.8;

      for (let i = 0; i < PROMEDIOS_CURSOS_NUMERICOS.length; i++) {
        const curso = PROMEDIOS_CURSOS_NUMERICOS[i];
        const nota = Math.min(
          20,
          Math.round((base + offset + i * 1.2 + (studentId % 3)) * 10) / 10,
        );
        rows.push({
          studentId,
          curso,
          tipo: 'numerico',
          bimestre,
          anio,
          valorNumerico: nota,
          nivelLogro: null,
        });
      }

      for (let i = 0; i < PROMEDIOS_AREAS_COMPETENCIA.length; i++) {
        const area = PROMEDIOS_AREAS_COMPETENCIA[i];
        const nivel =
          PROMEDIOS_NIVELES[(studentId + i + bimestre) % PROMEDIOS_NIVELES.length];
        rows.push({
          studentId,
          curso: area,
          tipo: 'competencia',
          bimestre,
          anio,
          valorNumerico: null,
          nivelLogro: nivel,
        });
      }
    }
  }

  return rows;
}
