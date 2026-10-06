import { ExpedienteResponse } from '../students.mapper';

export interface ExpedientesPageResponse {
  items: ExpedienteResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpedientesPageQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  grado?: string;
  estado?: string;
  estadoDocumento?: string;
  institutionId?: number;
}
