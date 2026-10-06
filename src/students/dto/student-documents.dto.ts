import { DocumentoEstado } from '../entities/student-document.entity';
import { DocumentoArchivoResponse } from './student-document-upload.dto';

export interface DocumentoMatriculaItem {
  id?: number;
  tipo: string;
  obligatorio: boolean;
  estado: DocumentoEstado;
  numero: string;
  fechaEntrega: string;
  imagenUrl?: string;
  registrado: boolean;
  archivo?: DocumentoArchivoResponse | null;
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
