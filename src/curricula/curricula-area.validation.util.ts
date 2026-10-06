import { BadRequestException } from '@nestjs/common';

export function normalizeAreaNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

export function assertNombreAreaValido(nombre: string): string {
  const normalized = normalizeAreaNombre(nombre);
  if (normalized.length < 2) {
    throw new BadRequestException('El nombre del área debe tener al menos 2 caracteres.');
  }
  if (normalized.length > 120) {
    throw new BadRequestException('El nombre del área no puede superar 120 caracteres.');
  }
  return normalized;
}

export function assertSinDuplicadoArea(
  nombre: string,
  existentes: Array<{ nombre: string; activo?: boolean }>,
  excludeId?: number,
): void {
  const key = normalizeAreaNombre(nombre).toLowerCase();
  const dup = existentes.find(
    (a) =>
      a.activo !== false &&
      normalizeAreaNombre(a.nombre).toLowerCase() === key,
  );
  if (dup && excludeId == null) {
    throw new BadRequestException(
      `Ya existe un área activa con el nombre «${normalizeAreaNombre(nombre)}» en esta currícula.`,
    );
  }
}

export function assertCurriculaEditable(estado: string): void {
  if (estado === 'inactivo') {
    throw new BadRequestException(
      'No se pueden modificar áreas de una currícula inactiva. Active o copie la currícula vigente.',
    );
  }
}
