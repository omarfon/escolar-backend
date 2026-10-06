import type { EstadoTraslado } from './transfer.constants';
import { ACCION_TRASLADO_LABEL, ESTADOS_TRASLADO_TERMINALES } from './transfer.constants';

export type EtapaSeguimientoEstado =
  | 'pendiente'
  | 'en_curso'
  | 'completado'
  | 'fallido'
  | 'omitido';

export interface EtapaSeguimiento {
  id: string;
  etiqueta: string;
  estado: EtapaSeguimientoEstado;
  fechaCompletado: string | null;
  descripcion: string;
}

export interface LineaTiempoItem {
  id: string;
  tipo: 'evento' | 'notificacion' | 'auditoria';
  fecha: string;
  titulo: string;
  detalle: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface SeguimientoResumen {
  estadoActual: EstadoTraslado;
  diasEnProceso: number;
  plazoVence: string;
  plazoVencido: boolean;
  ultimaActividad: string | null;
  esTerminal: boolean;
}

const ETAPAS_DEF = [
  {
    id: 'registro',
    etiqueta: 'Registro en IE origen',
    descripcion: 'Solicitud registrada y documentada en la institución de origen.',
  },
  {
    id: 'envio',
    etiqueta: 'Envío a IE destino',
    descripcion: 'La solicitud fue remitida formalmente a la institución de destino.',
  },
  {
    id: 'revision',
    etiqueta: 'Revisión y resolución',
    descripcion: 'La IE destino o el ámbito territorial evalúa la solicitud.',
  },
  {
    id: 'aprobacion',
    etiqueta: 'Aprobación',
    descripcion: 'Resolución favorable que habilita el traslado.',
  },
  {
    id: 'cierre',
    etiqueta: 'Cierre y matrícula',
    descripcion: 'Conclusión del traslado, cierre en origen y alta en la IE de destino.',
  },
] as const;

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function diasEntre(inicio: Date | string, fin: Date | string): number {
  const a = new Date(inicio);
  const b = new Date(fin);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function hoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

function fechaEventoPorAccion(
  eventos: Array<{ accion: string; createdAt: Date | string }>,
  acciones: string[],
): string | null {
  const hit = [...eventos].reverse().find((e) => acciones.includes(e.accion));
  return hit ? isoDate(hit.createdAt) : null;
}

export function construirEtapasSeguimiento(
  estadoActual: EstadoTraslado,
  eventos: Array<{ accion: string; createdAt: Date | string }>,
): EtapaSeguimiento[] {
  const cancelada = estadoActual === 'cancelada';
  const rechazada = estadoActual === 'rechazada';
  const concluida = estadoActual === 'concluida';
  const aprobada = estadoActual === 'aprobada' || concluida;
  const enviadaOMas = !['borrador'].includes(estadoActual);
  const enRevision = ['enviada', 'observada'].includes(estadoActual);

  const registroEstado: EtapaSeguimientoEstado =
    estadoActual === 'borrador' && !cancelada ? 'en_curso' : cancelada ? 'completado' : 'completado';

  const envioEstado: EtapaSeguimientoEstado = cancelada
    ? 'omitido'
    : enviadaOMas
      ? 'completado'
      : 'pendiente';

  const revisionEstado: EtapaSeguimientoEstado = cancelada
    ? 'omitido'
    : rechazada
      ? 'fallido'
      : aprobada || concluida
        ? 'completado'
        : enRevision
          ? 'en_curso'
          : estadoActual === 'borrador'
            ? 'pendiente'
            : 'pendiente';

  const aprobacionEstado: EtapaSeguimientoEstado = cancelada || rechazada
    ? 'omitido'
    : aprobada
      ? 'completado'
      : enRevision
        ? 'pendiente'
        : 'pendiente';

  const cierreEstado: EtapaSeguimientoEstado = cancelada || rechazada
    ? 'omitido'
    : concluida
      ? 'completado'
      : aprobada
        ? 'en_curso'
        : 'pendiente';

  const estadosPorEtapa = [registroEstado, envioEstado, revisionEstado, aprobacionEstado, cierreEstado];
  const fechasPorEtapa = [
    fechaEventoPorAccion(eventos, ['crear', 'actualizar']) ?? fechaEventoPorAccion(eventos, ['registrar_motivo']),
    fechaEventoPorAccion(eventos, ['enviar']),
    fechaEventoPorAccion(eventos, ['observar', 'aprobar', 'rechazar']),
    fechaEventoPorAccion(eventos, ['aprobar']),
    fechaEventoPorAccion(eventos, ['concluir']),
  ];

  return ETAPAS_DEF.map((def, index) => ({
    id: def.id,
    etiqueta: def.etiqueta,
    descripcion: def.descripcion,
    estado: estadosPorEtapa[index],
    fechaCompletado:
      ['completado', 'fallido'].includes(estadosPorEtapa[index]) ? fechasPorEtapa[index] : null,
  }));
}

export function etiquetaAccionEvento(accion: string): string {
  if (accion === 'crear') return 'Creó la solicitud';
  if (accion === 'actualizar') return 'Actualizó la solicitud';
  if (accion === 'registrar_motivo') return 'Registró motivo u observación';
  const label = ACCION_TRASLADO_LABEL[accion as keyof typeof ACCION_TRASLADO_LABEL];
  return label ?? accion;
}

export function construirLineaTiempo(input: {
  eventos: Array<{
    id: number;
    accion: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    motivo: string;
    observacion?: string;
    actorNombre: string;
    createdAt: Date | string;
  }>;
  notificaciones: Array<{
    id: number;
    mensaje: string;
    ambito: string;
    destinatario: string;
    estadoEntrega: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    createdAt: Date | string;
  }>;
  auditoria: Array<{
    id: number;
    accion: string;
    descripcion: string;
    usuarioNombre: string;
    resultado: string;
    detalle: Record<string, unknown> | null;
    createdAt: Date | string;
  }>;
}): LineaTiempoItem[] {
  const items: LineaTiempoItem[] = [];

  for (const e of input.eventos) {
    const detallePartes = [e.motivo?.trim()].filter(Boolean);
    if (e.estadoAnterior !== e.estadoNuevo) {
      detallePartes.unshift(`${e.estadoAnterior ?? '—'} → ${e.estadoNuevo}`);
    }
    if (e.observacion?.trim()) detallePartes.push(`Observación: ${e.observacion.trim()}`);
    items.push({
      id: `evento-${e.id}`,
      tipo: 'evento',
      fecha: isoDate(e.createdAt),
      titulo: etiquetaAccionEvento(e.accion),
      detalle: detallePartes.join(' · ') || 'Sin detalle adicional',
      actor: e.actorNombre || 'Sistema',
      metadata: { accion: e.accion, estadoNuevo: e.estadoNuevo },
    });
  }

  for (const n of input.notificaciones) {
    items.push({
      id: `notificacion-${n.id}`,
      tipo: 'notificacion',
      fecha: isoDate(n.createdAt),
      titulo: `Notificación ${n.estadoEntrega}`,
      detalle: `${n.mensaje} (${n.ambito} · ${n.destinatario})`,
      actor: 'Sistema',
      metadata: {
        estadoAnterior: n.estadoAnterior,
        estadoNuevo: n.estadoNuevo,
        estadoEntrega: n.estadoEntrega,
      },
    });
  }

  for (const a of input.auditoria) {
    items.push({
      id: `auditoria-${a.id}`,
      tipo: 'auditoria',
      fecha: isoDate(a.createdAt),
      titulo: `Auditoría: ${a.accion}`,
      detalle: a.descripcion,
      actor: a.usuarioNombre || 'Sistema',
      metadata: {
        resultado: a.resultado,
        detalle: a.detalle ?? undefined,
      },
    });
  }

  return items.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

export function construirResumenSeguimiento(input: {
  estado: EstadoTraslado;
  createdAt: Date | string;
  plazoHasta: string;
  lineaTiempo: LineaTiempoItem[];
}): SeguimientoResumen {
  const ultima =
    input.lineaTiempo.length > 0
      ? input.lineaTiempo[input.lineaTiempo.length - 1].fecha
      : isoDate(input.createdAt);
  return {
    estadoActual: input.estado,
    diasEnProceso: diasEntre(input.createdAt, new Date()),
    plazoVence: input.plazoHasta.slice(0, 10),
    plazoVencido: input.plazoHasta.slice(0, 10) < hoyLima(),
    ultimaActividad: ultima,
    esTerminal: ESTADOS_TRASLADO_TERMINALES.includes(input.estado),
  };
}

export type RolVisualizadorSeguimiento = 'origen' | 'destino' | 'territorial';

export function rolVisualizadorSeguimiento(
  modularInstitucion: string,
  origenModular: string,
  destinoModular: string,
  esTerritorial: boolean,
): RolVisualizadorSeguimiento {
  if (esTerritorial) return 'territorial';
  const modular = modularInstitucion.trim();
  if (modular && origenModular.trim() === modular) return 'origen';
  if (modular && destinoModular.trim() === modular) return 'destino';
  return 'territorial';
}
