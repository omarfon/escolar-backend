import { DataSource } from 'typeorm';

export async function prepareCompetencyChangeAuditTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS competency_change_logs (
      id SERIAL PRIMARY KEY,
      "evaluationId" integer NULL,
      "studentId" integer NOT NULL,
      "competenciaId" integer NOT NULL,
      "curriculumId" integer NOT NULL,
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
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_comp_change_student_created
    ON competency_change_logs ("studentId", "createdAt" DESC)
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_comp_change_eval_created
    ON competency_change_logs ("evaluationId", "createdAt" DESC)
  `);
}
