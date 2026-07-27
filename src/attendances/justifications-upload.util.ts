import { BadRequestException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
];

export interface JustificacionAdjuntoMeta {
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
}

export function saveJustificationFiles(
  files: Express.Multer.File[],
  studentId: number,
  justificationId: number,
): JustificacionAdjuntoMeta[] {
  if (!files?.length) return [];
  if (files.length > MAX_FILES) {
    throw new BadRequestException(`Máximo ${MAX_FILES} archivos por justificación`);
  }

  const saved: JustificacionAdjuntoMeta[] = [];
  const folder = join(
    process.cwd(),
    'uploads',
    'justifications',
    String(studentId),
    String(justificationId),
  );
  mkdirSync(folder, { recursive: true });

  for (const file of files) {
    if (!file?.buffer?.length) continue;
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(
        `El archivo "${file.originalname}" supera el límite de 10 MB`,
      );
    }

    const mime = file.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.originalname}`,
      );
    }

    const safeName = file.originalname.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_');
    const stored = `${Date.now()}-${safeName}`;
    writeFileSync(join(folder, stored), file.buffer);

    saved.push({
      url: `/uploads/justifications/${studentId}/${justificationId}/${stored}`,
      nombreArchivo: file.originalname,
      mimeType: mime,
      tamanoBytes: file.size,
    });
  }

  return saved;
}
