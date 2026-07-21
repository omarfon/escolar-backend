import { EventoEstado } from './entities/evento.entity';

export function parseEventDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function computeEstadoFromDates(
  fechaInicio: string,
  fechaFin?: string | null,
  cancelado?: boolean,
): EventoEstado {
  if (cancelado) return 'cancelado';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = parseEventDate(fechaInicio);
  const fin = parseEventDate(fechaFin ?? fechaInicio);

  if (fin < today) return 'finalizado';
  if (inicio <= today && fin >= today) return 'en_curso';
  return 'programado';
}

export function normalizeEventEstado(input: {
  estado?: string;
  cancelado?: boolean;
  fechaInicio: string;
  fechaFin?: string | null;
}): EventoEstado {
  if (input.cancelado || input.estado === 'cancelado') return 'cancelado';

  const manual = input.estado as EventoEstado | undefined;
  if (
    manual === 'programado' ||
    manual === 'en_curso' ||
    manual === 'finalizado'
  ) {
    return manual;
  }

  return computeEstadoFromDates(
    input.fechaInicio,
    input.fechaFin,
    input.cancelado,
  );
}

export function canceladoFromEstado(estado: EventoEstado): boolean {
  return estado === 'cancelado';
}
