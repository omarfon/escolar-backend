import { DataSource } from 'typeorm';

export async function prepareEnrollmentEvaluationsTable(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS enrollment_evaluations (
      id SERIAL PRIMARY KEY,
      "anioEscolar" integer NOT NULL,
      origen varchar(15) NOT NULL,
      "waitlistEntryId" integer NULL,
      "studentId" integer NULL,
      "candidatoNombre" varchar(160) NOT NULL DEFAULT '',
      "candidatoDni" varchar(20) NOT NULL DEFAULT '',
      nivel varchar(20) NOT NULL DEFAULT '',
      grado varchar(20) NOT NULL DEFAULT '',
      "seccionDeseada" varchar(5) NOT NULL DEFAULT '',
      "tipoEvaluacion" varchar(80) NOT NULL,
      "fechaEvaluacion" date NOT NULL,
      resultado varchar(30) NOT NULL,
      puntaje decimal(5,2) NULL,
      observaciones varchar(500) NOT NULL DEFAULT '',
      resolucion text NOT NULL,
      estado varchar(20) NOT NULL DEFAULT 'registrado',
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_eval_waitlist_tipo_anio
    ON enrollment_evaluations ("waitlistEntryId", "tipoEvaluacion", "anioEscolar")
    WHERE "waitlistEntryId" IS NOT NULL
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_eval_student_tipo_anio
    ON enrollment_evaluations ("studentId", "tipoEvaluacion", "anioEscolar")
    WHERE "studentId" IS NOT NULL
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_enrollment_eval_correlation
    ON enrollment_evaluations ("correlationId")
    WHERE "correlationId" IS NOT NULL
  `);
}
