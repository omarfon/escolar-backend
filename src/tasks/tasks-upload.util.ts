import { BadRequestException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAX_BYTES = 10 * 1024 * 1024;

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
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
];

export interface SavedTaskSubmissionFile {
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
}

export function saveTaskSubmissionFile(
  file: Express.Multer.File,
  studentId: number,
  taskId: number,
): SavedTaskSubmissionFile {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Debe adjuntar un archivo de entrega');
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestException('El archivo supera el límite de 10 MB');
  }

  const mime = file.mimetype || 'application/octet-stream';
  if (!ALLOWED_MIMES.includes(mime)) {
    throw new BadRequestException(`Tipo de archivo no permitido: ${mime}`);
  }

  const safeName = file.originalname.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_');
  const folder = join(process.cwd(), 'uploads', 'task-submissions', String(studentId));
  mkdirSync(folder, { recursive: true });

  const stored = `task-${taskId}-${Date.now()}-${safeName}`;
  writeFileSync(join(folder, stored), file.buffer);

  return {
    url: `/uploads/task-submissions/${studentId}/${stored}`,
    nombreArchivo: file.originalname,
    mimeType: mime,
    tamanoBytes: file.size,
  };
}
