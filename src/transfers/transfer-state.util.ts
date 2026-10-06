import {
  AccionTraslado,
  EstadoTraslado,
} from './transfer.constants';

export type PermisoTransicionTraslado = 'solicitar' | 'resolver' | 'aprobar_destino';

const TRANSICIONES: Record<
  AccionTraslado,
  { from: EstadoTraslado[]; to: EstadoTraslado; permiso: PermisoTransicionTraslado }
> = {
  enviar: { from: ['borrador', 'observada'], to: 'enviada', permiso: 'solicitar' },
  cancelar: { from: ['borrador', 'enviada', 'observada'], to: 'cancelada', permiso: 'solicitar' },
  observar: { from: ['enviada'], to: 'observada', permiso: 'resolver' },
  aprobar: { from: ['enviada', 'observada'], to: 'aprobada', permiso: 'aprobar_destino' },
  rechazar: { from: ['enviada', 'observada'], to: 'rechazada', permiso: 'aprobar_destino' },
  concluir: { from: ['aprobada'], to: 'concluida', permiso: 'resolver' },
};

export function siguienteEstado(
  actual: EstadoTraslado,
  accion: AccionTraslado,
): EstadoTraslado | null {
  const regla = TRANSICIONES[accion];
  if (!regla.from.includes(actual)) return null;
  return regla.to;
}

export function permisoDeAccion(accion: AccionTraslado): PermisoTransicionTraslado {
  return TRANSICIONES[accion].permiso;
}

export function hoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

export function codigoTraslado(anio: number, id: number): string {
  return `TR-${anio}-${String(id).padStart(4, '0')}`;
}

/** La IE de origen ve todo el expediente. La de destino lo ve desde que la solicitud fue enviada. */
export function iePuedeVerSolicitud(
  modularInstitucion: string,
  origenModular: string,
  destinoModular: string,
  estado: EstadoTraslado,
): boolean {
  const modular = modularInstitucion.trim();
  if (!modular) return false;
  if (origenModular.trim() === modular) return true;
  return destinoModular.trim() === modular && estado !== 'borrador';
}
