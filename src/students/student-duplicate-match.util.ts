import { Student } from './entities/student.entity';
import { buildCodigo } from './students.mapper';

export interface DuplicateMatchInput {
  nombres: string;
  apellidos: string;
  fechaNac?: string | null;
  sexo?: string;
  padreDni?: string;
  madreDni?: string;
  apoderadoDni?: string;
}

export interface DuplicateMatchCandidate {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  fechaNac: string | null;
  sexo: string;
  estadoDocumento: string;
  coincidencias: string[];
}

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

export function scoreDuplicateMatch(
  student: Student,
  input: DuplicateMatchInput,
): DuplicateMatchCandidate | null {
  const coincidencias: string[] = [];
  const inputNombre = normalizePersonName(input.nombres);
  const inputApellido = normalizePersonName(input.apellidos);
  const studentNombre = normalizePersonName(student.nombre);
  const studentApellido = normalizePersonName(
    student.apellido ||
      [student.apellidoPaterno, student.apellidoMaterno].filter(Boolean).join(' '),
  );

  if (
    inputNombre &&
    inputApellido &&
    inputNombre === studentNombre &&
    inputApellido === studentApellido
  ) {
    coincidencias.push('Nombres y apellidos idénticos');
  }

  if (
    input.fechaNac &&
    student.fechaNac &&
    input.fechaNac === student.fechaNac
  ) {
    coincidencias.push('Misma fecha de nacimiento');
  }

  if (input.sexo && student.sexo && input.sexo === student.sexo) {
    coincidencias.push('Mismo sexo');
  }

  const familyDnIs = [
    { label: 'DNI apoderado', value: input.apoderadoDni },
    { label: 'DNI padre', value: input.padreDni },
    { label: 'DNI madre', value: input.madreDni },
  ].filter((x) => x.value?.trim());

  for (const fam of familyDnIs) {
    const doc = fam.value!.trim();
    const reps = [student.apoderado, student.padre, student.madre];
    if (reps.some((r) => r?.dni?.trim() === doc)) {
      coincidencias.push(`${fam.label} coincidente`);
    }
  }

  const strongNameMatch =
    coincidencias.includes('Nombres y apellidos idénticos') &&
    coincidencias.includes('Misma fecha de nacimiento');

  if (coincidencias.length < 2 && !strongNameMatch) {
    return null;
  }

  return {
    id: student.id,
    codigo: buildCodigo(student.id, student.codigo),
    nombres: student.nombre,
    apellidos:
      student.apellido ||
      [student.apellidoPaterno, student.apellidoMaterno].filter(Boolean).join(' '),
    fechaNac: student.fechaNac,
    sexo: student.sexo,
    estadoDocumento: student.estadoDocumento ?? 'regular',
    coincidencias,
  };
}

export function findDuplicateCandidates(
  students: Student[],
  input: DuplicateMatchInput,
): DuplicateMatchCandidate[] {
  const results: DuplicateMatchCandidate[] = [];
  for (const student of students) {
    const match = scoreDuplicateMatch(student, input);
    if (match) results.push(match);
  }
  return results.sort((a, b) => b.coincidencias.length - a.coincidencias.length);
}
