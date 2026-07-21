import {
  EventoDestinatario,
  EventoVisibilidad,
} from './entities/evento.entity';

export interface EventVisibilityInput {
  visibilidad?: string;
  destinatarios?: string;
  nivel?: string;
  grado?: string;
  seccion?: string;
}

export interface NormalizedEventVisibility {
  visibilidad: EventoVisibilidad;
  destinatarios: EventoDestinatario;
  nivel: string;
  grado: string;
  seccion: string;
}

export function normalizeEventVisibility(
  dto: EventVisibilityInput,
): NormalizedEventVisibility {
  const visibilidad: EventoVisibilidad =
    dto.visibilidad === 'limitado' ? 'limitado' : 'global';

  if (visibilidad === 'global') {
    return {
      visibilidad: 'global',
      destinatarios: 'todos',
      nivel: '',
      grado: '',
      seccion: '',
    };
  }

  const dest = (dto.destinatarios ?? 'alumnos') as EventoDestinatario;
  if (dest === 'salon') {
    return {
      visibilidad: 'limitado',
      destinatarios: 'salon',
      nivel: dto.nivel?.trim() ?? '',
      grado: dto.grado?.trim() ?? '',
      seccion: dto.seccion?.trim().toUpperCase() ?? '',
    };
  }

  return {
    visibilidad: 'limitado',
    destinatarios: dest,
    nivel: dto.nivel?.trim() ?? '',
    grado: '',
    seccion: '',
  };
}

export function inferEventVisibility(event: {
  visibilidad?: string;
  destinatarios: string;
  grado?: string;
  seccion?: string;
}): EventoVisibilidad {
  if (event.visibilidad === 'global' || event.visibilidad === 'limitado') {
    return event.visibilidad;
  }
  if (event.destinatarios === 'todos' && !event.grado?.trim() && !event.seccion?.trim()) {
    return 'global';
  }
  return 'limitado';
}
