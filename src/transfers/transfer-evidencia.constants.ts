export const EVIDENCIA_TIPOS_TRASLADO = ['documento', 'referencia'] as const;

export type EvidenciaTrasladoTipo = (typeof EVIDENCIA_TIPOS_TRASLADO)[number];

export type EvidenciaTrasladoTipoPersistido = EvidenciaTrasladoTipo | 'legacy';
