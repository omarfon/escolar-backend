import { Student } from '../students/entities/student.entity';
import { ContinuityEnrollment } from './entities/continuity-enrollment.entity';

export const PROGRESION: Record<string, string> = {
  '1° Inicial': '2° Inicial',
  '2° Inicial': '3° Inicial',
  '3° Inicial': '1° Primaria',
  '1° Primaria': '2° Primaria',
  '2° Primaria': '3° Primaria',
  '3° Primaria': '4° Primaria',
  '4° Primaria': '5° Primaria',
  '5° Primaria': '6° Primaria',
  '6° Primaria': '1° Secundaria',
  '1° Secundaria': '2° Secundaria',
  '2° Secundaria': '3° Secundaria',
  '3° Secundaria': '4° Secundaria',
  '4° Secundaria': '5° Secundaria',
  '5° Secundaria': 'Egresado',
};

export function gradoLabelFromStudent(student: Student): string {
  const g = student.grado.trim();
  if (
    g.includes('Primaria') ||
    g.includes('Secundaria') ||
    g.includes('Inicial')
  ) {
    return g;
  }
  return `${g} ${student.nivel}`.trim();
}

export function gradoSig(
  gradoActual: string,
  situacion: ContinuityEnrollment['situacion'],
): string {
  if (situacion === 'egresado') return 'Egresado';
  if (situacion === 'retirado') return '—';
  if (situacion === 'repitente') return gradoActual;
  return PROGRESION[gradoActual] ?? gradoActual;
}

export function seccionPropuesta(
  situacion: ContinuityEnrollment['situacion'],
  seccionActual: string,
): string {
  if (situacion === 'retirado' || situacion === 'egresado') return '—';
  return seccionActual;
}

export function situacionFromPromedio(
  promedio: number,
): ContinuityEnrollment['situacion'] {
  return promedio >= 11 ? 'promovido' : 'repitente';
}

export interface ContinuityCandidateResponse {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  sexo: 'M' | 'F';
  nivel: string;
  gradoActual: string;
  seccionActual: string;
  promedioFinal: number;
  situacion: ContinuityEnrollment['situacion'];
  gradoPropuesto: string;
  seccionPropuesta: string;
  vacantesDisponibles?: number;
  aforoSalon?: number;
  generado: boolean;
  seleccionado: boolean;
}

export interface ContinuityRecordResponse {
  id: number;
  estudianteId: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  gradoAnterior: string;
  seccionAnterior: string;
  gradoNuevo: string;
  seccionNueva: string;
  promedioFinal: number;
  situacion: ContinuityEnrollment['situacion'];
  anioAnterior: number;
  anioNuevo: number;
  fechaGeneracion: string;
  generadoPor: string;
  estado: ContinuityEnrollment['estado'];
  vacantesDisponibles?: number;
  aforoSalon?: number;
  aprobadoPor?: string;
  fechaAprobacion?: string;
  motivoRechazo?: string;
}

export function toCandidateResponse(
  student: Student,
  promedio: number,
  situacion: ContinuityEnrollment['situacion'],
  generado: boolean,
): ContinuityCandidateResponse {
  const gradoActual = gradoLabelFromStudent(student);
  const nivelNorm = student.nivel.trim().toLowerCase();
  const nivel =
    nivelNorm.includes('inicial') ? 'inicial'
    : nivelNorm.includes('secundaria') ? 'secundaria'
    : nivelNorm.includes('primaria') ? 'primaria'
    : gradoActual.toLowerCase().includes('inicial') ? 'inicial'
    : gradoActual.toLowerCase().includes('secundaria') ? 'secundaria'
    : gradoActual.toLowerCase().includes('primaria') ? 'primaria'
    : '';
  return {
    id: student.id,
    codigo: student.codigo,
    nombres: student.nombre,
    apellidos: student.apellido,
    dni: student.dni,
    sexo: student.sexo,
    nivel,
    gradoActual,
    seccionActual: student.seccion,
    promedioFinal: promedio,
    situacion,
    gradoPropuesto: gradoSig(gradoActual, situacion),
    seccionPropuesta: seccionPropuesta(situacion, student.seccion),
    generado,
    seleccionado: false,
  };
}

export function toRecordResponse(
  record: ContinuityEnrollment,
  student: Student,
): ContinuityRecordResponse {
  const fechaGen = record.fechaGeneracion
    ? new Date(record.fechaGeneracion).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const fechaApro = record.fechaAprobacion
    ? new Date(record.fechaAprobacion).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : undefined;

  return {
    id: record.id,
    estudianteId: record.studentId,
    codigo: student.codigo,
    nombres: student.nombre,
    apellidos: student.apellido,
    gradoAnterior: record.gradoAnterior,
    seccionAnterior: record.seccionAnterior,
    gradoNuevo: record.gradoNuevo,
    seccionNueva: record.seccionNueva,
    promedioFinal: record.promedioFinal,
    situacion: record.situacion,
    anioAnterior: record.anioAnterior,
    anioNuevo: record.anioNuevo,
    fechaGeneracion: fechaGen,
    generadoPor: record.generadoPor,
    estado: record.estado,
    aprobadoPor: record.aprobadoPor ?? undefined,
    fechaAprobacion: fechaApro,
    motivoRechazo: record.motivoRechazo || undefined,
  };
}

export function formatFechaDisplay(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
