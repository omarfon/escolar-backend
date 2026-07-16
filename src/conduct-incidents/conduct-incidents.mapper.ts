import { Student } from '../students/entities/student.entity';
import { ConductIncident } from './entities/conduct-incident.entity';

export interface ConductIncidentResponse {
  id: number;
  alumnoId: number;
  alumno: string;
  grado: string;
  seccion: string;
  tipo: ConductIncident['tipo'];
  descripcion: string;
  fecha: string;
  fechaIso: string;
  lugar: string;
  reportadoPor: string;
  estado: ConductIncident['estado'];
  medida: string;
  notificadoPadre: boolean;
  observaciones: string;
}

export function formatFechaDisplay(fecha: string): string {
  if (!fecha) return '';
  const parts = fecha.includes('/')
    ? fecha.split('/')
    : fecha.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return fecha;
}

export function normalizeFechaInput(fecha: string): string {
  if (!fecha?.trim()) return new Date().toISOString().slice(0, 10);
  if (fecha.includes('/')) {
    const [d, m, y] = fecha.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return fecha.slice(0, 10);
}

export interface ConductResumenAlumno {
  alumnoId: number;
  alumno: string;
  grado: string;
  seccion: string;
  leves: number;
  graves: number;
  muyGraves: number;
  reconocimientos: number;
  nivel: 'excelente' | 'bueno' | 'regular' | 'deficiente';
}

export interface ConductKpis {
  total: number;
  leves: number;
  graves: number;
  muyGraves: number;
  reconocimientos: number;
}

export interface ConductIncidentsPage {
  items: ConductIncidentResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: ConductKpis;
  resumen: ConductResumenAlumno[];
  grados: string[];
}

export function calcNivelConducta(
  incidents: Array<Pick<ConductIncidentResponse, 'tipo'>>,
): ConductResumenAlumno['nivel'] {
  const mg = incidents.filter((i) => i.tipo === 'falta_muy_grave').length;
  const g = incidents.filter((i) => i.tipo === 'falta_grave').length;
  const l = incidents.filter((i) => i.tipo === 'falta_leve').length;
  const r = incidents.filter((i) => i.tipo === 'reconocimiento').length;
  if (mg > 0 || g >= 3) return 'deficiente';
  if (g >= 1 || l >= 3) return 'regular';
  if (r >= 2 && l === 0) return 'excelente';
  return 'bueno';
}

export function buildConductResumen(
  incidents: ConductIncidentResponse[],
): ConductResumenAlumno[] {
  const mapa = new Map<number, ConductIncidentResponse[]>();
  for (const inc of incidents) {
    mapa.set(inc.alumnoId, [...(mapa.get(inc.alumnoId) ?? []), inc]);
  }
  return [...mapa.entries()]
    .map(([alumnoId, incs]) => {
      const first = incs[0];
      return {
        alumnoId,
        alumno: first.alumno,
        grado: first.grado,
        seccion: first.seccion,
        leves: incs.filter((i) => i.tipo === 'falta_leve').length,
        graves: incs.filter((i) => i.tipo === 'falta_grave').length,
        muyGraves: incs.filter((i) => i.tipo === 'falta_muy_grave').length,
        reconocimientos: incs.filter((i) => i.tipo === 'reconocimiento').length,
        nivel: calcNivelConducta(incs),
      };
    })
    .sort((a, b) => a.alumno.localeCompare(b.alumno));
}

export function buildConductKpis(
  incidents: ConductIncidentResponse[],
): ConductKpis {
  return {
    total: incidents.length,
    leves: incidents.filter((i) => i.tipo === 'falta_leve').length,
    graves: incidents.filter((i) => i.tipo === 'falta_grave').length,
    muyGraves: incidents.filter((i) => i.tipo === 'falta_muy_grave').length,
    reconocimientos: incidents.filter((i) => i.tipo === 'reconocimiento').length,
  };
}
export function toConductIncidentResponse(
  incident: ConductIncident,
  student?: Student | null,
): ConductIncidentResponse {
  const fechaIso =
    typeof incident.fecha === 'string'
      ? incident.fecha.slice(0, 10)
      : String(incident.fecha).slice(0, 10);

  return {
    id: incident.id,
    alumnoId: incident.studentId,
    alumno: student ? `${student.nombre} ${student.apellido}`.trim() : 'Desconocido',
    grado: student?.grado ?? '',
    seccion: student?.seccion ?? '',
    tipo: incident.tipo,
    descripcion: incident.descripcion,
    fecha: formatFechaDisplay(fechaIso),
    fechaIso,
    lugar: incident.lugar ?? '',
    reportadoPor: incident.reportadoPor ?? '',
    estado: incident.estado,
    medida: incident.medida ?? '',
    notificadoPadre: incident.notificadoPadre ?? false,
    observaciones: incident.observaciones ?? '',
  };
}
