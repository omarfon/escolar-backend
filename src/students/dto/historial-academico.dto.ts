export interface HistorialAsistenciaResumen {
  total: number;
  presentes: number;
  faltas: number;
  tardanzas: number;
  justificadas: number;
  porcentaje: number;
}

export interface HistorialNotaItem {
  curso: string;
  bimestre: number;
  tipo: string;
  nota: number;
  fechaEvaluacion: string;
}

export interface HistorialTrayectoriaItem {
  anio: string;
  grado: string;
  seccion: string;
  promedio: number;
  estado: string;
  esActual: boolean;
  asistencia: HistorialAsistenciaResumen;
  notas: HistorialNotaItem[];
}

export interface HistorialAcademicoListItem {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  nivel: string;
  gradoActual: string;
  seccionActual: string;
  anioIngreso: string;
  aniosRegistrados: number;
  promedioUltimo: number | null;
  asistenciaPct: number;
  conductaNota: string;
  estado: string;
}

export interface HistorialAcademicoDetalle {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  nivel: string;
  gradoActual: string;
  seccionActual: string;
  anioIngreso: string;
  conductaNota: string;
  asistenciaPct: number;
  trayectoria: HistorialTrayectoriaItem[];
  notasActuales: HistorialNotaItem[];
  resumenNotas: {
    promedioGeneral: number | null;
    totalRegistros: number;
    porBimestre: Array<{ bimestre: number; promedio: number; cantidad: number }>;
  };
}
