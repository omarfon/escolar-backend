import { Student } from './entities/student.entity';

export function studentAulaKey(student: Pick<Student, 'nivel' | 'grado' | 'seccion'>): string {
  return `${student.nivel}|${student.grado}|${student.seccion.trim().toUpperCase()}`;
}

export function studentPersonKey(
  student: Pick<Student, 'id' | 'nivel' | 'grado' | 'seccion' | 'nombre' | 'apellido'>,
): string {
  const nombre = (student.nombre ?? '').trim().toLowerCase();
  const apellido = (student.apellido ?? '').trim().toLowerCase();
  if (!nombre && !apellido) {
    return `${studentAulaKey(student)}|id:${student.id}`;
  }
  return `${studentAulaKey(student)}|${nombre}|${apellido}`;
}

export function isStudentMatriculaActiva(
  student: Pick<Student, 'activo' | 'estadoMatricula'>,
): boolean {
  if (!student.activo) return false;
  const estado = student.estadoMatricula ?? 'activo';
  return estado === 'activo';
}

/** Alumnos únicos matriculados en un salón (misma lógica que registro de notas). */
export function listStudentsForAula(
  students: Student[],
  nivel: string,
  grado: string,
  seccion: string,
): Student[] {
  return dedupeStudentsByPerson(
    students.filter(
      (s) =>
        isStudentMatriculaActiva(s) &&
        s.nivel === nivel &&
        s.grado === grado &&
        matchesStudentSection(s, seccion),
    ),
  );
}

/** Conserva un solo registro por alumno en la misma aula (nombre + apellido). */
export function dedupeStudentsByPerson(students: Student[]): Student[] {
  const best = new Map<string, Student>();

  for (const student of students) {
    const key = studentPersonKey(student);
    const current = best.get(key);
    if (!current || studentPriority(student) < studentPriority(current)) {
      best.set(key, student);
    }
  }

  return [...best.values()].sort((a, b) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
  );
}

function studentPriority(student: Student): number {
  let score = student.id;
  if (student.email && !/^alumno\.\d+@estudiante\.pe$/i.test(student.email)) {
    score -= 1_000_000;
  }
  if (student.codigo?.trim()) {
    score -= 100_000;
  }
  if (student.dni?.trim()) {
    score -= 10_000;
  }
  return score;
}

export function matchesStudentSection(
  student: Pick<Student, 'seccion'>,
  seccion: string,
): boolean {
  return student.seccion.trim().toUpperCase() === seccion.trim().toUpperCase();
}
