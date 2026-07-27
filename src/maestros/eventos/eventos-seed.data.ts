import { EventoTipo } from '../../events/entities/evento.entity';

/** Catálogo demo — cargar con npm run db:events-data o db:demo-student-catalog / db:seed. La API solo lee BD. */
export const MAESTRO_EVENTOS_SEED: Array<{
  titulo: string;
  descripcion: string;
  tipo: EventoTipo;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  lugar: string;
  destinatarios: 'alumnos' | 'padres' | 'todos' | 'docentes' | 'salon';
  visibilidad: 'global' | 'limitado';
  nivel: string;
  grado: string;
  seccion: string;
  responsable: string;
  publicado: boolean;
}> = [
  {
    titulo: 'Olimpiadas Escolares 2026',
    descripcion: 'Competencias deportivas inter-aulas. Inscripciones en secretaría.',
    tipo: 'deportivo',
    fechaInicio: '2026-06-20',
    fechaFin: '2026-06-20',
    horaInicio: '08:00',
    horaFin: '13:00',
    lugar: 'Patio principal',
    destinatarios: 'alumnos',
    visibilidad: 'limitado',
    nivel: '',
    grado: '',
    seccion: '',
    responsable: 'Dept. Educación Física',
    publicado: true,
  },
  {
    titulo: 'Reunión de padres — 2° Bimestre',
    descripcion: 'Entrega de informes y retroalimentación del bimestre.',
    tipo: 'reunion',
    fechaInicio: '2026-06-25',
    fechaFin: '2026-06-25',
    horaInicio: '18:00',
    horaFin: '20:00',
    lugar: 'Auditorio',
    destinatarios: 'padres',
    visibilidad: 'limitado',
    nivel: 'Primaria',
    grado: '',
    seccion: '',
    responsable: 'Dirección',
    publicado: true,
  },
  {
    titulo: 'Feria de Ciencias',
    descripcion: 'Exposición de proyectos de investigación por grado.',
    tipo: 'academico',
    fechaInicio: '2026-07-05',
    fechaFin: '2026-07-06',
    horaInicio: '09:00',
    horaFin: '14:00',
    lugar: 'Pabellón de ciencias',
    destinatarios: 'todos',
    visibilidad: 'global',
    nivel: '',
    grado: '',
    seccion: '',
    responsable: 'Coord. Académica',
    publicado: true,
  },
  {
    titulo: 'Festival de Danzas Folclóricas',
    descripcion: 'Presentación artística por niveles Inicial, Primaria y Secundaria.',
    tipo: 'cultural',
    fechaInicio: '2026-07-18',
    fechaFin: '2026-07-18',
    horaInicio: '10:00',
    horaFin: '12:30',
    lugar: 'Coliseo',
    destinatarios: 'todos',
    visibilidad: 'global',
    nivel: '',
    grado: '',
    seccion: '',
    responsable: 'Dept. Arte y Cultura',
    publicado: true,
  },
  {
    titulo: 'Capacitación docente — Evaluación por competencias',
    descripcion: 'Taller interno para docentes de todos los niveles.',
    tipo: 'reunion',
    fechaInicio: '2026-06-10',
    fechaFin: '2026-06-10',
    horaInicio: '15:00',
    horaFin: '17:00',
    lugar: 'Sala de profesores',
    destinatarios: 'docentes',
    visibilidad: 'limitado',
    nivel: '',
    grado: '',
    seccion: '',
    responsable: 'UGEL / Dirección',
    publicado: true,
  },
  {
    titulo: 'Charla vocacional — 5° Primaria A',
    descripcion: 'Orientación vocacional exclusiva para el aula 5° A.',
    tipo: 'academico',
    fechaInicio: '2026-07-12',
    fechaFin: '2026-07-12',
    horaInicio: '10:00',
    horaFin: '11:30',
    lugar: 'Aula 5° A',
    destinatarios: 'salon',
    visibilidad: 'limitado',
    nivel: 'Primaria',
    grado: '5°',
    seccion: 'A',
    responsable: 'Orientación',
    publicado: true,
  },
];