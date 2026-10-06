import { DataSource } from 'typeorm';

export async function prepareStudentWithdrawalsTable(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS student_withdrawals (
      id SERIAL PRIMARY KEY,
      "studentId" integer NOT NULL,
      "studentCodigo" varchar(20) NOT NULL DEFAULT '',
      "studentNombre" varchar(160) NOT NULL DEFAULT '',
      "anioEscolar" integer NOT NULL,
      nivel varchar(20) NOT NULL DEFAULT '',
      grado varchar(20) NOT NULL DEFAULT '',
      seccion varchar(5) NOT NULL DEFAULT '',
      "fechaRetiro" date NOT NULL,
      motivo varchar(80) NOT NULL,
      sustento text NOT NULL,
      estado varchar(20) NOT NULL DEFAULT 'registrado',
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      "notasConservadas" integer NOT NULL DEFAULT 0,
      "asistenciasConservadas" integer NOT NULL DEFAULT 0,
      "vacantesDisponiblesDespues" integer NOT NULL DEFAULT 0,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_student_withdrawal_student_anio
    ON student_withdrawals ("studentId", "anioEscolar")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_student_withdrawal_correlation
    ON student_withdrawals ("correlationId")
    WHERE "correlationId" IS NOT NULL
  `);
}
