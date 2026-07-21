import { MaestroPeriodoTipo } from './entities/maestro-periodo-academico.entity';

export interface MaestroPeriodoAcademicoSeed {
  anioEscolar: number;
  numero: number;
  nombre: string;
  tipo: MaestroPeriodoTipo;
  inicio: string;
  fin: string;
  actual: boolean;
  descripcion?: string;
}

/** Calendario escolar Perú — A.E. 2026 (4 bimestres) */
export const MAESTRO_PERIODOS_ACADEMICOS_SEED: MaestroPeriodoAcademicoSeed[] = [
  {
    anioEscolar: 2026,
    numero: 1,
    nombre: '1° Bimestre',
    tipo: 'bimestre',
    inicio: '2026-03-10',
    fin: '2026-05-09',
    actual: false,
    descripcion: 'Inicio del año escolar. Adaptación y diagnóstico.',
  },
  {
    anioEscolar: 2026,
    numero: 2,
    nombre: '2° Bimestre',
    tipo: 'bimestre',
    inicio: '2026-05-12',
    fin: '2026-07-25',
    actual: true,
    descripcion: 'Periodo en curso. Registro de evaluaciones formativas.',
  },
  {
    anioEscolar: 2026,
    numero: 3,
    nombre: '3° Bimestre',
    tipo: 'bimestre',
    inicio: '2026-08-11',
    fin: '2026-10-17',
    actual: false,
    descripcion: 'Consolidación de aprendizajes y proyectos integradores.',
  },
  {
    anioEscolar: 2026,
    numero: 4,
    nombre: '4° Bimestre',
    tipo: 'bimestre',
    inicio: '2026-10-20',
    fin: '2026-12-19',
    actual: false,
    descripcion: 'Cierre de año. Actas finales y promoción.',
  },
  {
    anioEscolar: 2024,
    numero: 1,
    nombre: '1° Bimestre',
    tipo: 'bimestre',
    inicio: '2024-03-11',
    fin: '2024-05-10',
    actual: false,
    descripcion: 'Año escolar 2024.',
  },
  {
    anioEscolar: 2024,
    numero: 2,
    nombre: '2° Bimestre',
    tipo: 'bimestre',
    inicio: '2024-05-13',
    fin: '2024-07-26',
    actual: false,
  },
  {
    anioEscolar: 2024,
    numero: 3,
    nombre: '3° Bimestre',
    tipo: 'bimestre',
    inicio: '2024-08-12',
    fin: '2024-10-18',
    actual: false,
  },
  {
    anioEscolar: 2024,
    numero: 4,
    nombre: '4° Bimestre',
    tipo: 'bimestre',
    inicio: '2024-10-21',
    fin: '2024-12-20',
    actual: false,
  },
  {
    anioEscolar: 2023,
    numero: 1,
    nombre: '1° Bimestre',
    tipo: 'bimestre',
    inicio: '2023-03-13',
    fin: '2023-05-12',
    actual: false,
    descripcion: 'Año escolar 2023.',
  },
  {
    anioEscolar: 2023,
    numero: 2,
    nombre: '2° Bimestre',
    tipo: 'bimestre',
    inicio: '2023-05-15',
    fin: '2023-07-28',
    actual: false,
  },
  {
    anioEscolar: 2023,
    numero: 3,
    nombre: '3° Bimestre',
    tipo: 'bimestre',
    inicio: '2023-08-14',
    fin: '2023-10-20',
    actual: false,
  },
  {
    anioEscolar: 2023,
    numero: 4,
    nombre: '4° Bimestre',
    tipo: 'bimestre',
    inicio: '2023-10-23',
    fin: '2023-12-22',
    actual: false,
  },
  {
    anioEscolar: 2025,
    numero: 1,
    nombre: 'I Trimestre',
    tipo: 'trimestre',
    inicio: '2025-03-10',
    fin: '2025-06-13',
    actual: false,
    descripcion: 'Año escolar 2025 — estructura trimestral.',
  },
  {
    anioEscolar: 2025,
    numero: 2,
    nombre: 'II Trimestre',
    tipo: 'trimestre',
    inicio: '2025-07-14',
    fin: '2025-10-03',
    actual: false,
  },
  {
    anioEscolar: 2025,
    numero: 3,
    nombre: 'III Trimestre',
    tipo: 'trimestre',
    inicio: '2025-10-06',
    fin: '2025-12-19',
    actual: false,
  },
];
