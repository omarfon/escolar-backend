export const ESTADOS_TRASLADO = [
  'borrador',
  'enviada',
  'observada',
  'aprobada',
  'rechazada',
  'cancelada',
  'concluida',
] as const;

export type EstadoTraslado = (typeof ESTADOS_TRASLADO)[number];

export const ESTADOS_TRASLADO_ACTIVOS: EstadoTraslado[] = [
  'borrador',
  'enviada',
  'observada',
  'aprobada',
];

export const ESTADOS_TRASLADO_TERMINALES: EstadoTraslado[] = [
  'rechazada',
  'cancelada',
  'concluida',
];

/** Acciones de transición que exigen motivo explícito (mín. 5 caracteres). */
export const ACCIONES_TRASLADO_MOTIVO_OBLIGATORIO: AccionTraslado[] = [
  'cancelar',
  'observar',
  'rechazar',
  'aprobar',
  'concluir',
];

export const ACCION_REGISTRAR_MOTIVO = 'registrar_motivo' as const;

export const ACCIONES_TRASLADO = [
  'enviar',
  'cancelar',
  'observar',
  'aprobar',
  'rechazar',
  'concluir',
] as const;

export type AccionTraslado = (typeof ACCIONES_TRASLADO)[number];

export const PERMISO_TRASLADOS_VER = 'traslados.ver';
export const PERMISO_TRASLADOS_SOLICITAR = 'traslados.solicitar';
export const PERMISO_TRASLADOS_RESOLVER = 'traslados.resolver';
export const PERMISO_TRASLADOS_APROBAR_DESTINO = 'traslados.aprobar_destino';

export const ACCION_TRASLADO_LABEL: Record<AccionTraslado, string> = {
  enviar: 'Envió la solicitud de traslado',
  cancelar: 'Canceló la solicitud de traslado',
  observar: 'Observó la solicitud de traslado',
  aprobar: 'Aprobó la solicitud de traslado',
  rechazar: 'Rechazó la solicitud de traslado',
  concluir: 'Concluyó la solicitud de traslado',
};
