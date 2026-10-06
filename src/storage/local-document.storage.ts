import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import type { Readable } from 'stream';
import {
  DocumentStorage,
  PutStudentDocumentInput,
  StoredDocumentFile,
} from './document-storage.interface';

export class LocalDocumentStorage extends DocumentStorage {
  readonly driver = 'local' as const;

  putStudentDocument(input: PutStudentDocumentInput): Promise<StoredDocumentFile> {
    const ext = extname(input.originalName) || mimeToExt(input.mimeType);
    const safeBase = input.originalName
      .replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_')
      .replace(/\.[^.]+$/, '');
    const stored = `v${input.version}-${Date.now()}-${safeBase}${ext}`;
    const relFolder = join(
      'student-documents',
      String(input.studentId),
      String(input.documentId),
    );
    const absFolder = join(process.cwd(), 'uploads', relFolder);
    mkdirSync(absFolder, { recursive: true });
    const absPath = join(absFolder, stored);
    writeFileSync(absPath, input.buffer);

    const url = `/uploads/${relFolder.replace(/\\/g, '/')}/${stored}`;

    return Promise.resolve({
      storagePath: absPath,
      url,
      nombreArchivo: input.originalName,
      mimeType: input.mimeType,
      tamanoBytes: input.size,
      sha256: input.sha256,
    });
  }

  openReadStream(storagePath: string): Promise<Readable> {
    return Promise.resolve(createReadStream(storagePath));
  }

  exists(storagePath: string): Promise<boolean> {
    return Promise.resolve(existsSync(storagePath));
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime] ?? '';
}
