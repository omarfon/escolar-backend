import { FormulaComponente } from './entities/maestro-formula-evaluacion.entity';

export const COMPONENTES_EVALUACION_ESTANDAR: FormulaComponente[] = [
  {
    codigo: 'examen_parcial',
    nombre: 'Examen Parcial',
    peso: 30,
    orden: 1,
    activo: true,
  },
  {
    codigo: 'examen_final',
    nombre: 'Examen Final',
    peso: 40,
    orden: 2,
    activo: true,
  },
  {
    codigo: 'trabajo_exposicion',
    nombre: 'Trabajo / Exposición',
    peso: 30,
    orden: 3,
    activo: true,
  },
];

export const MAESTRO_FORMULAS_EVALUACION_SEED = [
  {
    nombre: 'Evaluación estándar (Primaria)',
    codigo: 'FORM-PRIM-STD',
    nivel: 'Primaria',
    grado: '',
    curso: '',
    bimestre: null,
    componentes: COMPONENTES_EVALUACION_ESTANDAR,
    escalaLogro: { AD: 17.5, A: 14, B: 11 },
    esDefault: true,
    orden: 0,
    activo: true,
  },
  {
    nombre: 'Evaluación estándar (Secundaria)',
    codigo: 'FORM-SEC-STD',
    nivel: 'Secundaria',
    grado: '',
    curso: '',
    bimestre: null,
    componentes: COMPONENTES_EVALUACION_ESTANDAR,
    escalaLogro: { AD: 17.5, A: 14, B: 11 },
    esDefault: false,
    orden: 1,
    activo: true,
  },
];
