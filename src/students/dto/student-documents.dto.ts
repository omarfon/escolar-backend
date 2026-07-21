import { DocumentoEstado } from '../entities/student-document.entity';

export interface DocumentoMatriculaItem {
  id?: number;
  tipo: string;
  obligatorio: boolean;
  estado: DocumentoEstado;
  numero: string;
  fechaEntrega: string;
  imagenUrl?: string;
  registrado: boolean;
}

export interface StudentDocumentsResponse {
  studentId: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  gradoLabel: string;
  seccion: string;
  anioIngreso: string;
  documentos: DocumentoMatriculaItem[];
  entregados: number;
  total: number;
  obligatoriosPendientes: number;
}
