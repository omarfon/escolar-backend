import { BadRequestException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ResourceTipo } from './entities/teacher-resource.entity';

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_BY_TIPO: Record<string, string[]> = {
  imagen: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  documento: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  excel: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  ppt: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  clase: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  lectura: ['application/pdf', 'text/plain'],
  tarea: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  evaluacion: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

export interface SavedResourceFile {
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
}

export function saveResourceFile(
  file: Express.Multer.File,
  tipo: ResourceTipo,
  salon: { nivel: string; grado: string; seccion: string },
): SavedResourceFile {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Debe adjuntar un archivo');
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestException('El archivo supera el límite de 10 MB');
  }

  const allowed = ALLOWED_BY_TIPO[tipo] ?? ALLOWED_BY_TIPO.documento;
  const mime = file.mimetype || 'application/octet-stream';
  if (!allowed.includes(mime)) {
    throw new BadRequestException(
      `Tipo de archivo no permitido para ${tipo}: ${mime}`,
    );
  }

  const safeName = file.originalname.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_');
  const folder = join(
    process.cwd(),
    'uploads',
    'teacher-resources',
    `${salon.nivel}-${salon.grado}-${salon.seccion}`.replace(/\s+/g, '_'),
  );
  mkdirSync(folder, { recursive: true });

  const stored = `${Date.now()}-${safeName}`;
  const fullPath = join(folder, stored);
  writeFileSync(fullPath, file.buffer);

  const publicPath = `/uploads/teacher-resources/${`${salon.nivel}-${salon.grado}-${salon.seccion}`.replace(/\s+/g, '_')}/${stored}`;

  return {
    url: publicPath,
    nombreArchivo: file.originalname,
    mimeType: mime,
    tamanoBytes: file.size,
  };
}

export function tipoUsaArchivo(tipo: ResourceTipo): boolean {
  return !['enlace'].includes(tipo);
}

export function tipoUsaUrl(tipo: ResourceTipo): boolean {
  return ['enlace', 'video'].includes(tipo);
}
