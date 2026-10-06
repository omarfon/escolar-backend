import { DataSource } from 'typeorm';

export async function prepareStudentDocumentFilesTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS student_document_versions (
      id SERIAL PRIMARY KEY,
      "documentId" integer NOT NULL,
      "studentId" integer NOT NULL,
      version integer NOT NULL,
      "nombreArchivo" varchar(255) NOT NULL,
      "mimeType" varchar(120) NOT NULL,
      "tamanoBytes" integer NOT NULL,
      sha256 varchar(64) NOT NULL,
      "storagePath" text NOT NULL,
      url text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      "vigenciaHasta" date NULL,
      "uploadedByUserId" integer NULL,
      "uploadedByNombre" varchar(120) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_student_doc_versions_document
    ON student_document_versions ("documentId", version DESC)
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_student_doc_versions_active
    ON student_document_versions ("documentId")
    WHERE activo = true
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS student_document_audit_logs (
      id SERIAL PRIMARY KEY,
      "studentId" integer NOT NULL,
      "documentId" integer NULL,
      "versionId" integer NULL,
      accion varchar(30) NOT NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      detalle jsonb NOT NULL DEFAULT '{}',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      resultado varchar(10) NOT NULL DEFAULT 'success',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_student_doc_audit_student_created
    ON student_document_audit_logs ("studentId", "createdAt" DESC)
  `);
}
