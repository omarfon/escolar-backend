export interface HorarioAssignmentSeed {
  docenteUsername: string;
  cursoNombre: string;
  nivel: string;
  grado: string;
  secciones: string[];
}

/** Asignaciones docente-curso requeridas para armar los horarios demo. */
export const HORARIO_ASSIGNMENTS_SEED: HorarioAssignmentSeed[] = [
  // Primaria 5°
  { docenteUsername: 'docente', cursoNombre: 'Matemática', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'r.salas', cursoNombre: 'Matemática', nivel: 'Primaria', grado: '5°', secciones: ['B'] },
  { docenteUsername: 'm.flores', cursoNombre: 'Comprensión Lectora', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'm.flores', cursoNombre: 'Producción de Textos', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'e.quispe', cursoNombre: 'Ciencia y Tecnología', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'r.ccapa', cursoNombre: 'Historia del Perú', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'c.lazo', cursoNombre: 'Arte y Cultura', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'h.terrazas', cursoNombre: 'Educación Física', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'm.pauca', cursoNombre: 'Inglés', nivel: 'Primaria', grado: '5°', secciones: ['A', 'B'] },
  { docenteUsername: 'f.calcina', cursoNombre: 'Ed. Religiosa', nivel: 'Primaria', grado: '5°', secciones: ['A'] },
  { docenteUsername: 'd.vela', cursoNombre: 'Geografía', nivel: 'Primaria', grado: '5°', secciones: ['B'] },
  // Secundaria 3°
  { docenteUsername: 'juan.perez', cursoNombre: 'Álgebra', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'r.salas', cursoNombre: 'Geometría', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 's.benavides', cursoNombre: 'Comunicación', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'e.quispe', cursoNombre: 'Biología', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'o.nunez', cursoNombre: 'Física', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'd.vela', cursoNombre: 'Historia del Perú', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'r.salas', cursoNombre: 'Geografía', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'e.cordova', cursoNombre: 'Inglés', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'f.calcina', cursoNombre: 'DPCC', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'c.lazo', cursoNombre: 'Arte y Cultura', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
  { docenteUsername: 'h.terrazas', cursoNombre: 'Educación Física', nivel: 'Secundaria', grado: '3°', secciones: ['A'] },
];
