import type { Readable } from 'stream';

export interface StoredDocumentFile {
  storagePath: string;
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  sha256: string;
}

export interface PutStudentDocumentInput {
  studentId: number;
  documentId: number;
  version: number;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
}

export abstract class DocumentStorage {
  abstract readonly driver: 'local' | 'minio';

  abstract putStudentDocument(
    input: PutStudentDocumentInput,
  ): Promise<StoredDocumentFile>;

  abstract openReadStream(storagePath: string): Promise<Readable>;

  abstract exists(storagePath: string): Promise<boolean>;
}

export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');
