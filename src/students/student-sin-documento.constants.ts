/** Tipo de documento asignado mientras no hay identidad oficial. */
export const TIPO_DOCUMENTO_SIN = 'SIN_DOC';

export type EstadoDocumentoEstudiante = 'regular' | 'pendiente_regularizacion';

export const ESTADO_DOCUMENTO_REGULAR: EstadoDocumentoEstudiante = 'regular';
export const ESTADO_DOCUMENTO_PENDIENTE: EstadoDocumentoEstudiante =
  'pendiente_regularizacion';
