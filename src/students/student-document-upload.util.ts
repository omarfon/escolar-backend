import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  STUDENT_DOC_ALLOWED_MIMES,
  STUDENT_DOC_MAX_BYTES,
} from './student-documents.constants';

export function computeFileSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function validateStudentDocumentFile(
  file: Express.Multer.File,
): void {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Debe enviar un archivo');
  }
  if (file.size > STUDENT_DOC_MAX_BYTES) {
    throw new BadRequestException(
      `El archivo supera el límite de ${STUDENT_DOC_MAX_BYTES / (1024 * 1024)} MB`,
    );
  }
  const mime = file.mimetype || 'application/octet-stream';
  if (!STUDENT_DOC_ALLOWED_MIMES.includes(mime as (typeof STUDENT_DOC_ALLOWED_MIMES)[number])) {
    throw new BadRequestException(
      `Tipo de archivo no permitido (${mime}). Use PDF o imagen JPG/PNG/WebP.`,
    );
  }
}
