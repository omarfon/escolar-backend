import {
  REPRESENTANTE_VACIO,
  RepresentanteData,
  Student,
} from './entities/student.entity';
import { StudentDocument } from './entities/student-document.entity';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';

export interface ExpedienteDocumento {
  id: number;
  tipo: string;
  numero: string;
  estado: 'entregado' | 'pendiente' | 'vencido';
  fechaEntrega: string;
  imagenUrl?: string;
}

export interface ExpedienteHistorial {
  anio: string;
  grado: string;
  seccion: string;
  promedio: number;
  estado: string;
}

export interface ExpedienteResponse {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  fechaNac: string;
  sexo: 'M' | 'F';
  direccion: string;
  foto: string;
  grupoSanguineo: string;
  alergias: string;
  condicionesSalud: string;
  observaciones: string;
  nivel: string;
  grado: string;
  gradoLabel: string;
  seccion: string;
  anioIngreso: string;
  estado: 'activo' | 'inactivo' | 'retirado';
  activo: boolean;
  estadoCambioSeccion: 'elegible' | 'cambio_realizado';
  padre: RepresentanteData;
  madre: RepresentanteData;
  apoderado: RepresentanteData;
  historialAcademico: ExpedienteHistorial[];
  asistenciaPct: number;
  conductaNota: string;
  documentos: ExpedienteDocumento[];
}

export function gradoLabelFromParts(nivel: string, grado: string): string {
  const g = grado.trim();
  if (
    g.includes('Primaria') ||
    g.includes('Secundaria') ||
    g.includes('Inicial')
  ) {
    return g;
  }
  const suffix =
    nivel === 'Secundaria'
      ? 'Secundaria'
      : nivel === 'Primaria'
        ? 'Primaria'
        : nivel === 'Inicial'
          ? 'Inicial'
          : nivel;
  return `${g} ${suffix}`.trim();
}

/** Convierte DD/MM/YYYY o YYYY-MM-DD a formato ISO para PostgreSQL date. */
export function parseFechaNacInput(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const dash = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, day, month, year] = dash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

export function splitGradoLabel(label: string): { nivel: string; grado: string } {
  const trimmed = label.trim();
  if (trimmed.endsWith(' Secundaria')) {
    return {
      nivel: 'Secundaria',
      grado: trimmed.replace(/\s+Secundaria$/, '').trim(),
    };
  }
  if (trimmed.endsWith(' Primaria')) {
    return {
      nivel: 'Primaria',
      grado: trimmed.replace(/\s+Primaria$/, '').trim(),
    };
  }
  if (trimmed.endsWith(' Inicial')) {
    return {
      nivel: 'Inicial',
      grado: trimmed.replace(/\s+Inicial$/, '').trim(),
    };
  }
  return { nivel: 'Primaria', grado: trimmed };
}

export function normalizeRepresentante(
  data?: Partial<RepresentanteData> | null,
): RepresentanteData {
  if (!data) return { ...REPRESENTANTE_VACIO };
  return {
    nombres: data.nombres?.trim() ?? '',
    apellidos: data.apellidos?.trim() ?? '',
    dni: data.dni?.trim() ?? '',
    telefono: data.telefono?.trim() ?? '',
    email: data.email?.trim() ?? '',
    trabajo: data.trabajo?.trim() ?? '',
  };
}

export function buildCodigo(id: number, codigo?: string): string {
  if (codigo?.trim()) return codigo.trim();
  const year = new Date().getFullYear();
  return `${year}-${String(id).padStart(3, '0')}`;
}

export function toExpedienteResponse(
  student: Student,
  extras: {
    historial: StudentAcademicHistory[];
    documentos: StudentDocument[];
    asistenciaPct: number;
  },
): ExpedienteResponse {
  return {
    id: student.id,
    codigo: buildCodigo(student.id, student.codigo),
    nombres: student.nombre,
    apellidos: student.apellido,
    dni: student.dni ?? '',
    email: student.email,
    fechaNac: student.fechaNac ?? '',
    sexo: student.sexo ?? 'M',
    direccion: student.direccion ?? '',
    foto: student.foto ?? '',
    grupoSanguineo: student.grupoSanguineo ?? 'O+',
    alergias: student.alergias ?? '',
    condicionesSalud: student.condicionesSalud ?? '',
    observaciones: student.observaciones ?? '',
    nivel: student.nivel,
    grado: gradoLabelFromParts(student.nivel, student.grado),
    gradoLabel: gradoLabelFromParts(student.nivel, student.grado),
    seccion: student.seccion,
    anioIngreso: student.anioIngreso ?? String(new Date().getFullYear()),
    estado: student.estadoMatricula ?? (student.activo ? 'activo' : 'inactivo'),
    activo: student.activo,
    estadoCambioSeccion: student.estadoCambioSeccion ?? 'elegible',
    padre: normalizeRepresentante(student.padre),
    madre: normalizeRepresentante(student.madre),
    apoderado: normalizeRepresentante(student.apoderado),
    historialAcademico: extras.historial.map((h) => ({
      anio: h.anio,
      grado: h.grado,
      seccion: h.seccion,
      promedio: h.promedio,
      estado: h.estado,
    })),
    asistenciaPct: extras.asistenciaPct,
    conductaNota: student.conductaNota ?? 'AD',
    documentos: extras.documentos.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      numero: d.numero,
      estado: d.estado,
      fechaEntrega: d.fechaEntrega,
      imagenUrl: d.imagenUrl || undefined,
    })),
  };
}
