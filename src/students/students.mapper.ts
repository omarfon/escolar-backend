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
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  tipoDocumento: string;
  email: string;
  fechaNac: string;
  sexo: 'M' | 'F';
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  telefonoEmergencia: string;
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

export interface SectionChangeCandidateResponse {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  tipoDocumento: string;
  email: string;
  nivel: string;
  grado: string;
  seccion: string;
  activo: boolean;
  estado: 'activo' | 'inactivo' | 'retirado';
}

export function mapSectionChangeCandidate(
  student: Student,
  documento?: { dni: string; tipoDocumento: string } | null,
): SectionChangeCandidateResponse {
  let dni = student.dni?.trim() || documento?.dni?.trim() || '';
  if (!dni) {
    const fromEmail = student.email?.match(/^alumno\.(.+)@estudiante\.pe$/i)?.[1];
    if (fromEmail) dni = fromEmail.trim();
  }
  const tipoDocumento =
    student.tipoDocumento?.trim() || documento?.tipoDocumento?.trim() || 'DNI';

  return {
    id: student.id,
    codigo: buildCodigo(student.id, student.codigo),
    nombres: student.nombre,
    apellidos:
      student.apellido ||
      [student.apellidoPaterno, student.apellidoMaterno].filter(Boolean).join(' '),
    apellidoPaterno: student.apellidoPaterno ?? '',
    apellidoMaterno: student.apellidoMaterno ?? '',
    dni,
    tipoDocumento,
    email: student.email,
    nivel: student.nivel,
    grado: gradoLabelFromParts(student.nivel, student.grado),
    seccion: student.seccion,
    activo: student.activo,
    estado: student.estadoMatricula ?? (student.activo ? 'activo' : 'inactivo'),
  };
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
  const paterno = data.apellidoPaterno?.trim() ?? '';
  const materno = data.apellidoMaterno?.trim() ?? '';
  const apellidos =
    [paterno, materno].filter(Boolean).join(' ') || (data.apellidos?.trim() ?? '');
  return {
    nombres: data.nombres?.trim() ?? '',
    apellidos,
    apellidoPaterno: paterno,
    apellidoMaterno: materno,
    tipoDocumento: data.tipoDocumento?.trim() || 'DNI',
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

export function resolveApellidos(dto: {
  apellidos?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}): { apellido: string; apellidoPaterno: string; apellidoMaterno: string } {
  const paterno = dto.apellidoPaterno?.trim() ?? '';
  const materno = dto.apellidoMaterno?.trim() ?? '';
  const combined = [paterno, materno].filter(Boolean).join(' ');

  if (combined) {
    return { apellido: combined, apellidoPaterno: paterno, apellidoMaterno: materno };
  }

  const apellido = dto.apellidos?.trim() ?? '';
  if (!apellido) {
    return { apellido: '', apellidoPaterno: '', apellidoMaterno: '' };
  }

  const parts = apellido.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      apellido,
      apellidoPaterno: parts[0],
      apellidoMaterno: parts.slice(1).join(' '),
    };
  }

  return { apellido, apellidoPaterno: apellido, apellidoMaterno: '' };
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
    apellidos:
      student.apellido ||
      [student.apellidoPaterno, student.apellidoMaterno].filter(Boolean).join(' '),
    apellidoPaterno: student.apellidoPaterno ?? '',
    apellidoMaterno: student.apellidoMaterno ?? '',
    dni: student.dni ?? '',
    tipoDocumento: student.tipoDocumento ?? 'DNI',
    email: student.email,
    fechaNac: student.fechaNac ?? '',
    sexo: student.sexo ?? 'M',
    direccion: student.direccion ?? '',
    distrito: student.distrito ?? '',
    provincia: student.provincia ?? '',
    departamento: student.departamento ?? '',
    telefonoEmergencia: student.telefonoEmergencia ?? '',
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
