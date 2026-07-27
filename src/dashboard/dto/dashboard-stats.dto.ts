export interface DashboardVacanteDto {
  id: number;
  nivel: string;
  grado: string;
  seccion: string;
  label: string;
  capacidad: number;
  matriculados: number;
  disponibles: number;
  estado: 'disponible' | 'completa' | 'sobreocupada';
}

export interface DashboardStatsDto {
  anioEscolar: number;
  estudiantesMatriculados: number;
  docentesActivos: number;
  asistenciaPromedio: number;
  pagosPendientes: number;
  familiasConDeuda: number;
  totalRegistrosAsistencia: number;
  vacantesDisponibles: DashboardVacanteDto[];
}
