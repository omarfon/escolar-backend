import { DataSource } from 'typeorm';

/** Índices de rendimiento para consultas frecuentes bajo concurrencia. */
export async function preparePerformanceIndexes(ds: DataSource): Promise<void> {
  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_student_fecha
    ON attendances ("studentId", fecha)
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_grades_student_lookup
    ON grades ("studentId", curso, bimestre, "componenteCodigo")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_students_section_active
    ON students (nivel, grado, seccion)
    WHERE activo = true AND "estadoMatricula" = 'activo'
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_resource_estado
    ON tasks ("resourceId", estado, "fechaEntrega")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_teacher_resources_salon
    ON teacher_resources (nivel, grado, seccion, docente)
    WHERE visible = true
  `);
}
