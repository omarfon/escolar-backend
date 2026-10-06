import {
  HistorialAcademicoDetalle,
  HistorialAcademicoListItem,
} from '../../students/dto/historial-academico.dto';

export interface MatriculaHistorialEvento {
  id: string;
  tipo:
    | 'matricula'
    | 'retiro'
    | 'reingreso'
    | 'cambio_seccion'
    | 'continuidad'
    | 'evaluacion'
    | 'retroalimentacion'
    | 'traslado';
  fecha: string;
  titulo: string;
  descripcion: string;
  actorNombre?: string;
  actorRol?: string;
  metadata?: Record<string, unknown>;
}

export interface MatriculaHistorialContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
    codigoModular: string;
  };
  permisoConsultar: string;
  tiposEvento: Array<{ codigo: string; label: string }>;
}

export interface MatriculaHistorialDetalle {
  estudiante: {
    id: number;
    codigo: string;
    nombres: string;
    apellidos: string;
    dni: string;
    nivel: string;
    gradoActual: string;
    seccionActual: string;
    anioIngreso: string;
    estadoMatricula: string;
    activo: boolean;
  };
  resumen: {
    aniosRegistrados: number;
    eventosTotal: number;
    asistenciaPct: number;
    promedioGeneral: number | null;
  };
  trayectoriaAcademica: HistorialAcademicoDetalle['trayectoria'];
  eventosMatricula: MatriculaHistorialEvento[];
}

export interface MatriculaHistorialListResponse {
  items: HistorialAcademicoListItem[];
  total: number;
  page: number;
  pageSize: number;
}
