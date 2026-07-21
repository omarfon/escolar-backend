const G_INI = ['3 años', '4 años', '5 años'];
const G_PRI = ['1°', '2°', '3°', '4°', '5°', '6°'];
const G_SEC = ['1°', '2°', '3°', '4°', '5°'];

export type MaestroCursoSeed = {
  nombre: string;
  area: string;
  nivel: string;
  grados: string[];
  horasSemanales: number;
};

/** Clave única por nivel + nombre (p. ej. Primaria|Matemática). */
export function maestroCursoKey(nivel: string, nombre: string): string {
  return `${nivel}|${nombre}`;
}

/** Catálogo base de cursos por nivel (CNEB / reutilizable en currícula y asignación docente). */
export const MAESTRO_CURSOS_SEED: MaestroCursoSeed[] = [
  { nombre: 'Comunicación', area: 'Comunicación', nivel: 'Inicial', grados: G_INI, horasSemanales: 5 },
  { nombre: 'Matemática', area: 'Matemática', nivel: 'Inicial', grados: G_INI, horasSemanales: 4 },
  { nombre: 'Personal Social', area: 'Personal Social', nivel: 'Inicial', grados: G_INI, horasSemanales: 3 },
  { nombre: 'Ciencia y Tecnología', area: 'Ciencia y Tecnología', nivel: 'Inicial', grados: G_INI, horasSemanales: 3 },
  { nombre: 'Arte y Cultura', area: 'Arte y Cultura', nivel: 'Inicial', grados: G_INI, horasSemanales: 2 },
  { nombre: 'Psicomotricidad', area: 'Psicomotricidad', nivel: 'Inicial', grados: G_INI, horasSemanales: 3 },
  { nombre: 'Matemática', area: 'Matemática', nivel: 'Primaria', grados: G_PRI, horasSemanales: 6 },
  { nombre: 'Comprensión Lectora', area: 'Comunicación', nivel: 'Primaria', grados: G_PRI, horasSemanales: 3 },
  { nombre: 'Producción de Textos', area: 'Comunicación', nivel: 'Primaria', grados: G_PRI, horasSemanales: 2 },
  { nombre: 'Ciencia y Tecnología', area: 'Ciencia y Tecnología', nivel: 'Primaria', grados: G_PRI, horasSemanales: 3 },
  { nombre: 'Historia del Perú', area: 'Ciencias Sociales', nivel: 'Primaria', grados: ['4°', '5°', '6°'], horasSemanales: 2 },
  { nombre: 'Geografía', area: 'Ciencias Sociales', nivel: 'Primaria', grados: ['4°', '5°', '6°'], horasSemanales: 1 },
  { nombre: 'Arte y Cultura', area: 'Arte y Cultura', nivel: 'Primaria', grados: G_PRI, horasSemanales: 2 },
  { nombre: 'Educación Física', area: 'Educación Física', nivel: 'Primaria', grados: G_PRI, horasSemanales: 3 },
  { nombre: 'Personal Social', area: 'Personal Social', nivel: 'Primaria', grados: ['1°', '2°', '3°'], horasSemanales: 2 },
  { nombre: 'Inglés', area: 'Inglés', nivel: 'Primaria', grados: G_PRI, horasSemanales: 3 },
  { nombre: 'Ed. Religiosa', area: 'Ed. Religiosa', nivel: 'Primaria', grados: G_PRI, horasSemanales: 1 },
  { nombre: 'Álgebra', area: 'Matemática', nivel: 'Secundaria', grados: ['1°', '2°', '3°'], horasSemanales: 4 },
  { nombre: 'Geometría', area: 'Matemática', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 2 },
  { nombre: 'Trigonometría', area: 'Matemática', nivel: 'Secundaria', grados: ['4°', '5°'], horasSemanales: 3 },
  { nombre: 'Aritmética', area: 'Matemática', nivel: 'Secundaria', grados: ['1°', '2°'], horasSemanales: 2 },
  { nombre: 'Comunicación', area: 'Comunicación', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 4 },
  { nombre: 'Física', area: 'Ciencia y Tecnología', nivel: 'Secundaria', grados: ['3°', '4°', '5°'], horasSemanales: 3 },
  { nombre: 'Química', area: 'Ciencia y Tecnología', nivel: 'Secundaria', grados: ['3°', '4°', '5°'], horasSemanales: 2 },
  { nombre: 'Biología', area: 'Ciencia y Tecnología', nivel: 'Secundaria', grados: ['1°', '2°', '3°'], horasSemanales: 3 },
  { nombre: 'CTA', area: 'Ciencia y Tecnología', nivel: 'Secundaria', grados: ['1°', '2°'], horasSemanales: 4 },
  { nombre: 'Historia del Perú', area: 'CCSS e Historia', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 2 },
  { nombre: 'Historia Universal', area: 'CCSS e Historia', nivel: 'Secundaria', grados: ['3°', '4°', '5°'], horasSemanales: 2 },
  { nombre: 'Geografía', area: 'CCSS e Historia', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 2 },
  { nombre: 'Inglés', area: 'Inglés', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 3 },
  { nombre: 'DPCC', area: 'DPCC', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 2 },
  { nombre: 'Arte y Cultura', area: 'Arte y Cultura', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 2 },
  { nombre: 'Educación Física', area: 'Educación Física', nivel: 'Secundaria', grados: G_SEC, horasSemanales: 3 },
  { nombre: 'Ed. para el Trabajo', area: 'Ed. para el Trabajo', nivel: 'Secundaria', grados: ['3°', '4°', '5°'], horasSemanales: 3 },
];
