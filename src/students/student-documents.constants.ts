export const STUDENT_DOC_MAX_BYTES = 10 * 1024 * 1024;

export const STUDENT_DOC_ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const STUDENT_DOC_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
];

export const PERMISO_DOCUMENTOS_VER = 'estudiantes.documentos';
export const PERMISO_DOCUMENTOS_CARGAR = 'estudiantes.documentos';
export const PERMISO_DOCUMENTOS_DESCARGAR = 'estudiantes.documentos';
