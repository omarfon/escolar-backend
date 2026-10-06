/** Código estable de la persona. El indicador de IE vive en cada año del historial. */
export function codigoNacionalDeAlumno(student: {
  id: number;
  tipoDocumento?: string | null;
  dni?: string | null;
}): string {
  const documento = (student.dni ?? '').trim();
  if (!documento) return `ALU-${String(student.id).padStart(6, '0')}`;
  const tipo = (student.tipoDocumento ?? '').trim().toUpperCase() || 'DNI';
  return `${tipo}-${documento}`;
}
