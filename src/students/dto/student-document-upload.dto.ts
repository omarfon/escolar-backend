import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadStudentDocumentDto {
  @IsString()
  @MinLength(3)
  motivo!: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  vigenciaHasta?: string;
}

export interface StudentDocumentsContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
  };
  permisoConsulta: string;
  permisoCarga: string;
  permisoDescarga: string;
  maxBytes: number;
  maxMb: number;
  formatosPermitidos: string[];
  mimeTypes: string[];
  storageDriver: 'local' | 'minio';
}

export interface DocumentoArchivoResponse {
  versionId: number;
  version: number;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  sha256: string;
  url: string;
  vigenciaHasta: string | null;
  uploadedAt: string;
  uploadedByNombre: string;
}

export interface StudentDocumentAuditResponse {
  id: number;
  studentId: number;
  documentId: number | null;
  versionId: number | null;
  accion: string;
  actorNombre: string;
  actorRol: string;
  motivo: string;
  detalle: Record<string, unknown>;
  resultado: string;
  createdAt: string;
}
