import { DataSource } from 'typeorm';

export async function prepareDiagnosticEvaluationsTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_evaluations (
      id SERIAL PRIMARY KEY,
      "studentId" integer NOT NULL,
      "institutionId" integer NULL,
      curso varchar(120) NOT NULL,
      bimestre integer NOT NULL DEFAULT 1,
      anio integer NOT NULL,
      nota double precision NULL,
      "nivelLogro" varchar(2) NULL,
      observacion text NULL,
      "fechaEvaluacion" date NOT NULL,
      "registradoPor" integer NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_diag_eval_student_curso_anio" UNIQUE ("studentId", curso, anio)
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_diag_eval_curso_anio
    ON diagnostic_evaluations (curso, anio, bimestre)
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_change_logs (
      id SERIAL PRIMARY KEY,
      "evaluationId" integer NULL,
      "studentId" integer NOT NULL,
      curso varchar(120) NOT NULL,
      "institutionId" integer NULL,
      bimestre integer NOT NULL,
      anio integer NOT NULL,
      accion varchar(20) NOT NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      cambios jsonb NOT NULL,
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      resultado varchar(10) NOT NULL DEFAULT 'success',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_diag_change_student_created
    ON diagnostic_change_logs ("studentId", "createdAt" DESC)
  `);
}
