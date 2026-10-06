import { DataSource } from 'typeorm';

export async function prepareEnrollmentFeedbacksTable(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS enrollment_feedbacks (
      id SERIAL PRIMARY KEY,
      "anioEscolar" integer NOT NULL,
      "enrollmentEvaluationId" integer NOT NULL,
      "waitlistEntryId" integer NULL,
      "studentId" integer NULL,
      "candidatoNombre" varchar(160) NOT NULL DEFAULT '',
      "candidatoDni" varchar(20) NOT NULL DEFAULT '',
      "tipoEvaluacion" varchar(80) NOT NULL DEFAULT '',
      "resultadoEvaluacion" varchar(30) NOT NULL DEFAULT '',
      canal varchar(40) NOT NULL,
      "fechaRetroalimentacion" date NOT NULL,
      destinatario varchar(120) NOT NULL DEFAULT '',
      mensaje text NOT NULL,
      "acuseRecibo" boolean NOT NULL DEFAULT false,
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_feedback_eval
    ON enrollment_feedbacks ("enrollmentEvaluationId")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_enrollment_feedback_correlation
    ON enrollment_feedbacks ("correlationId")
    WHERE "correlationId" IS NOT NULL
  `);
}
