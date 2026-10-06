import { DataSource } from 'typeorm';

export async function prepareStudentExceptionalEnrollmentColumns(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "matriculaExcepcional" boolean NOT NULL DEFAULT false
  `);
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "excepcionalMotivo" text NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "excepcionalSustento" text NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "edadNormativaAlRegistro" smallint NULL
  `);
  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_students_matricula_excepcional
    ON students ("matriculaExcepcional")
    WHERE "matriculaExcepcional" = true
  `);
}
