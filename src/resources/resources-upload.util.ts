import { BadRequestException } from '@nestjs/common';

import { mkdirSync, readFileSync, writeFileSync } from 'fs';

import { join } from 'path';

import { ResourceTipo } from './entities/teacher-resource.entity';



const MAX_BYTES = 10 * 1024 * 1024;



const ALLOWED_BY_TIPO: Record<string, string[]> = {

  imagen: [

    'image/jpeg',

    'image/png',

    'image/webp',

    'image/gif',

    'image/bmp',

    'image/svg+xml',

  ],

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

    'image/jpeg',

    'image/png',

    'image/webp',

    'image/gif',

    'image/bmp',

    'image/svg+xml',

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



const EXTENSION_MIME: Record<string, string> = {

  pdf: 'application/pdf',

  doc: 'application/msword',

  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  xls: 'application/vnd.ms-excel',

  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  csv: 'text/csv',

  ppt: 'application/vnd.ms-powerpoint',

  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  txt: 'text/plain',

  jpg: 'image/jpeg',

  jpeg: 'image/jpeg',

  png: 'image/png',

  webp: 'image/webp',

  gif: 'image/gif',

  bmp: 'image/bmp',

  svg: 'image/svg+xml',

  mp4: 'video/mp4',

  webm: 'video/webm',

  mov: 'video/quicktime',

};



export interface SavedResourceFile {

  url: string;

  nombreArchivo: string;

  mimeType: string;

  tamanoBytes: number;

}



function resolveMimeType(originalname: string, reported?: string): string {

  const ext = originalname.split('.').pop()?.toLowerCase() ?? '';

  const fromExt = ext ? EXTENSION_MIME[ext] : undefined;

  const normalized = (reported ?? '').trim().toLowerCase();



  if (

    !normalized ||

    normalized === 'application/octet-stream' ||

    normalized === 'binary/octet-stream'

  ) {

    return fromExt ?? normalized ?? 'application/octet-stream';

  }



  return normalized;

}



function readUploadBuffer(file: Express.Multer.File): Buffer {

  if (file.buffer?.length) return file.buffer;

  if (file.path) return readFileSync(file.path);

  throw new BadRequestException('Debe adjuntar un archivo');

}



export function saveResourceFile(

  file: Express.Multer.File,

  tipo: ResourceTipo,

  salon: { nivel: string; grado: string; seccion: string },

): SavedResourceFile {

  if (!file?.originalname) {

    throw new BadRequestException('Debe adjuntar un archivo');

  }



  const buffer = readUploadBuffer(file);

  if (!buffer.length) {

    throw new BadRequestException('Debe adjuntar un archivo');

  }

  if (file.size > MAX_BYTES) {

    throw new BadRequestException('El archivo supera el límite de 10 MB');

  }



  const allowed = ALLOWED_BY_TIPO[tipo] ?? ALLOWED_BY_TIPO.documento;

  const mime = resolveMimeType(file.originalname, file.mimetype);

  if (!allowed.includes(mime)) {

    throw new BadRequestException(

      `Tipo de archivo no permitido para ${tipo}: ${mime || file.originalname}`,

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

  writeFileSync(fullPath, buffer);



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


