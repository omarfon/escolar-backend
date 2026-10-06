export interface CursoPromedio {
  curso: string;
  tipo: 'numerico' | 'competencia';
  b1: number | null;
  b2: number | null;
  b3: number | null;
  b4: number | null;
  promedioAnual: number | null;
  nivel: string | null;
  b1Nivel?: string | null;
  b2Nivel?: string | null;
  b3Nivel?: string | null;
  b4Nivel?: string | null;
}

export interface AlumnoPromedio {
  studentId: number;
  estudiante: string;
  nivel: string;
  grado: string;
  seccion: string;
  cursos: CursoPromedio[];
  promedioGeneral: number | null;
  nivelGeneral: string | null;
}

export interface PromediosResumen {
  totalAlumnos: number;
  promedioAula: number | null;
  promedioAulaNivel: string | null;
  aprobados: number;
  desaprobados: number;
  enRiesgo: number;
  destacados: number;
}

export interface PromediosResponse {
  resumen: PromediosResumen;
  alumnos: AlumnoPromedio[];
  cursosDisponibles: string[];
  areasDisponibles: string[];
  bimestreActual: number;
  gradingConfig: import('../grading/grading-config.types').GradingConfigDto;
}

export interface PromediosQuery {
  nivel?: string;
  grado?: string;
  seccion?: string;
  curso?: string;
  busqueda?: string;
  institutionId?: number;
}
