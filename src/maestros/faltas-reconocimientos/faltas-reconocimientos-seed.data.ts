import { MaestroConductaCategoria } from './entities/maestro-conducta-tipo.entity';

export interface FaltasReconocimientosSeedTipo {
  codigo: string;
  nombre: string;
  categoria: MaestroConductaCategoria;
  icon: string;
  orden: number;
  descripciones: string[];
}

/** Catálogo inicial (database-seed.service.ts — ensureConductIncidents) */
export const FALTAS_RECONOCIMIENTOS_SEED: FaltasReconocimientosSeedTipo[] = [
  {
    codigo: 'falta_leve',
    nombre: 'Falta Leve',
    categoria: 'falta',
    icon: 'warning',
    orden: 1,
    descripciones: [
      'Llegada tarde al salón sin justificación',
      'Uso de celular durante clase',
      'No presentó tareas asignadas',
      'Interrupciones frecuentes durante la clase',
    ],
  },
  {
    codigo: 'falta_grave',
    nombre: 'Falta Grave',
    categoria: 'falta',
    icon: 'report',
    orden: 2,
    descripciones: [
      'Falta de respeto verbal hacia un compañero',
      'Destrucción de material escolar ajeno',
      'Abandono del aula sin permiso del docente',
      'Copiado durante evaluación',
    ],
  },
  {
    codigo: 'falta_muy_grave',
    nombre: 'Falta Muy Grave',
    categoria: 'falta',
    icon: 'gpp_bad',
    orden: 3,
    descripciones: [
      'Agresión física a un estudiante',
      'Intimidación y acoso a un compañero',
      'Daños graves a la infraestructura escolar',
      'Falta de respeto grave al personal docente',
    ],
  },
  {
    codigo: 'reconocimiento',
    nombre: 'Reconocimiento',
    categoria: 'reconocimiento',
    icon: 'emoji_events',
    orden: 4,
    descripciones: [
      'Excelente desempeño académico y disciplinario',
      'Apoyo destacado a compañeros en dificultades',
      'Representación destacada de la institución',
      'Liderazgo positivo en actividades escolares',
    ],
  },
];
