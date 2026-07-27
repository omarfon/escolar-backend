/** Estudiantes demo asistencia — cargar con npm run db:demo-student-catalog o db:seed. La API solo lee BD. */
export interface AsistenciaStudentSeed {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  nivel: string;
  grado: string;
  seccion: string;
  sexo?: 'M' | 'F';
}

/** Alumnos activos por sección para registro diario de asistencia (tabla students). */
export const ASISTENCIA_STUDENTS_SEED: AsistenciaStudentSeed[] = [
  // Hermanos de Juan Perez Lopez (apoderada: Maria Lopez Quispe / padre@escolar.pe)
  { nombre: 'Lucia', apellido: 'Perez Lopez', email: 'l.torres@estudiante.pe', dni: '71234568', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'F' },
  { nombre: 'Carlos', apellido: 'Perez Lopez', email: 'c.mendoza@estudiante.pe', dni: '71234569', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'M' },
  { nombre: 'Pedro', apellido: 'Salazar Luna', email: 'p.salazar@estudiante.pe', dni: '71234570', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'M' },
  { nombre: 'Rosa', apellido: 'Vargas Ortiz', email: 'r.vargas@estudiante.pe', dni: '71234571', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'F' },
  { nombre: 'Miguel', apellido: 'Condori Paz', email: 'm.condori@estudiante.pe', dni: '71234572', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'M' },
  { nombre: 'Valentina', apellido: 'Rojas Mejia', email: 'v.rojas@estudiante.pe', dni: '71234573', nivel: 'Primaria', grado: '5°', seccion: 'A', sexo: 'F' },
  { nombre: 'Ana', apellido: 'Garcia Lima', email: 'a.garcia@estudiante.pe', dni: '71234574', nivel: 'Primaria', grado: '5°', seccion: 'B', sexo: 'F' },
  { nombre: 'Jose', apellido: 'Paredes Cano', email: 'j.paredes@estudiante.pe', dni: '71234575', nivel: 'Primaria', grado: '5°', seccion: 'B', sexo: 'M' },
  { nombre: 'Sofia', apellido: 'Huaman Cruz', email: 's.huaman@estudiante.pe', dni: '71234576', nivel: 'Primaria', grado: '5°', seccion: 'B', sexo: 'F' },
  { nombre: 'Diego', apellido: 'Quispe Arce', email: 'd.quispe@estudiante.pe', dni: '71234577', nivel: 'Primaria', grado: '5°', seccion: 'B', sexo: 'M' },
  { nombre: 'Maria', apellido: 'Quispe Rojas', email: 'm.quispe@estudiante.pe', dni: '71234578', nivel: 'Primaria', grado: '4°', seccion: 'A', sexo: 'F' },
  { nombre: 'Luis', apellido: 'Castillo Vera', email: 'l.castillo@estudiante.pe', dni: '71234579', nivel: 'Primaria', grado: '4°', seccion: 'A', sexo: 'M' },
  { nombre: 'Camila', apellido: 'Flores Diaz', email: 'c.flores@estudiante.pe', dni: '71234580', nivel: 'Primaria', grado: '4°', seccion: 'A', sexo: 'F' },
  { nombre: 'Andres', apellido: 'Mamani Soto', email: 'a.mamani@estudiante.pe', dni: '71234581', nivel: 'Primaria', grado: '4°', seccion: 'A', sexo: 'M' },
  { nombre: 'Sofia', apellido: 'Ramos Cruz', email: 's.ramos@estudiante.pe', dni: '71234582', nivel: 'Secundaria', grado: '2°', seccion: 'A', sexo: 'F' },
  { nombre: 'Renato', apellido: 'Paredes Lino', email: 'r.paredes@estudiante.pe', dni: '71234583', nivel: 'Secundaria', grado: '2°', seccion: 'A', sexo: 'M' },
  { nombre: 'Gabriela', apellido: 'Torres Nina', email: 'g.torres@estudiante.pe', dni: '71234584', nivel: 'Secundaria', grado: '2°', seccion: 'A', sexo: 'F' },
  { nombre: 'Diego', apellido: 'Fernandez Mar', email: 'd.fernandez@estudiante.pe', dni: '71234585', nivel: 'Secundaria', grado: '2°', seccion: 'B', sexo: 'M' },
  { nombre: 'Paola', apellido: 'Caceres Ruiz', email: 'p.caceres@estudiante.pe', dni: '71234586', nivel: 'Secundaria', grado: '2°', seccion: 'B', sexo: 'F' },
  { nombre: 'Marco', apellido: 'Silva Vega', email: 'm.silva@estudiante.pe', dni: '71234587', nivel: 'Secundaria', grado: '2°', seccion: 'B', sexo: 'M' },
];
