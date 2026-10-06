import { DataSource } from 'typeorm';

export async function prepareStudentSinDocumentoColumns(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "estadoDocumento" varchar(30) NOT NULL DEFAULT 'regular'
  `);
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "sinDocumentoMotivo" text NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "sinDocumentoSustento" text NOT NULL DEFAULT ''
  `);
  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_students_estado_documento
    ON students ("estadoDocumento")
    WHERE "estadoDocumento" = 'pendiente_regularizacion'
  `);
}
