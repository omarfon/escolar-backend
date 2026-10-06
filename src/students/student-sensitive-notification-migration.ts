import { DataSource } from 'typeorm';

export async function prepareStudentSensitiveNotificationsTable(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS student_sensitive_notifications (
      id SERIAL PRIMARY KEY,
      "studentChangeLogId" integer NULL,
      "studentId" integer NOT NULL,
      "studentNombre" varchar(160) NOT NULL DEFAULT '',
      "studentCodigo" varchar(20) NOT NULL DEFAULT '',
      "camposNotificados" jsonb NOT NULL DEFAULT '[]',
      "correoDestino" varchar(120) NOT NULL DEFAULT '',
      "correoEnviado" boolean NOT NULL DEFAULT false,
      canal varchar(20) NOT NULL DEFAULT 'email',
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      ip varchar(45) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_student_sensitive_notif_student_created
    ON student_sensitive_notifications ("studentId", "createdAt" DESC)
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_student_sensitive_notif_change_log
    ON student_sensitive_notifications ("studentChangeLogId")
    WHERE "studentChangeLogId" IS NOT NULL
  `);
}
