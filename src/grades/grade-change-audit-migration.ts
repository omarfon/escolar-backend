import { DataSource } from 'typeorm';

export async function prepareGradeChangeLogsTable(ds: DataSource): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS grade_change_logs (
      id SERIAL PRIMARY KEY,
      "gradeId" integer NULL,
      "studentId" integer NOT NULL,
      "studentCodigo" varchar(20) NOT NULL DEFAULT '',
      "studentNombre" varchar(160) NOT NULL DEFAULT '',
      curso varchar(120) NOT NULL DEFAULT '',
      "componenteCodigo" varchar(40) NOT NULL DEFAULT '',
      bimestre integer NOT NULL,
      nivel varchar(40) NOT NULL DEFAULT '',
      grado varchar(20) NOT NULL DEFAULT '',
      seccion varchar(10) NOT NULL DEFAULT '',
      accion varchar(20) NOT NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      resultado varchar(10) NOT NULL DEFAULT 'success',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_grade_change_student_created
    ON grade_change_logs ("studentId", "createdAt" DESC)
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_grade_change_grade_created
    ON grade_change_logs ("gradeId", "createdAt" DESC)
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_grade_change_correlation
    ON grade_change_logs ("correlationId")
    WHERE "correlationId" IS NOT NULL
  `);
}
