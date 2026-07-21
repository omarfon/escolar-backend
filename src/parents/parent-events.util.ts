import type { EventResponse } from '../events/events.service';
import type { HijoResumen } from './parents.service';

export function eventAppliesToChild(
  event: EventResponse,
  child: HijoResumen,
): boolean {
  if (!event.publicado || event.cancelado) return false;
  if (event.destinatarios === 'docentes') return false;

  if (event.visibilidad === 'global' || event.destinatarios === 'todos') {
    return true;
  }

  if (event.destinatarios === 'padres' || event.destinatarios === 'alumnos') {
    if (!event.nivel?.trim()) return true;
    return normalizeNivel(event.nivel) === normalizeNivel(child.nivel);
  }

  if (event.destinatarios === 'salon') {
    return matchesSalon(event, child);
  }

  return false;
}

function matchesSalon(
  event: Pick<EventResponse, 'nivel' | 'grado' | 'seccion'>,
  child: HijoResumen,
): boolean {
  const nivelOk =
    !event.nivel?.trim() ||
    normalizeNivel(event.nivel) === normalizeNivel(child.nivel);
  const gradoOk =
    !event.grado?.trim() ||
    normalizeGrado(event.grado) === normalizeGrado(child.grado);
  const seccionOk =
    !event.seccion?.trim() ||
    event.seccion.trim().toUpperCase() === child.seccion.trim().toUpperCase();
  return nivelOk && gradoOk && seccionOk;
}

function normalizeNivel(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeGrado(value: string): string {
  const match = value.match(/\d+/);
  return match?.[0] ?? value.replace(/°/g, '').trim().toLowerCase();
}
