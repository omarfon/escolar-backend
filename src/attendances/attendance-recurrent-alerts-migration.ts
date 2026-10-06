import { DataSource } from 'typeorm';

export async function prepareAttendanceRecurrentAlertsTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    ALTER TABLE attendance_alert_settings
    ADD COLUMN IF NOT EXISTS "institutionId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE attendance_alert_settings
    ADD COLUMN IF NOT EXISTS "porcentajeUmbral" numeric(5,2) NOT NULL DEFAULT 15
  `);
  await ds.query(`
    ALTER TABLE attendance_alert_settings
    ADD COLUMN IF NOT EXISTS "periodoTipo" varchar(20) NOT NULL DEFAULT 'mes'
  `);
  await ds.query(`
    ALTER TABLE attendance_alert_settings
    ADD COLUMN IF NOT EXISTS "nivelEducativo" varchar(30) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE attendance_alert_settings
    ADD COLUMN IF NOT EXISTS modalidad varchar(20) NOT NULL DEFAULT 'todos'
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_settings_institution
    ON attendance_alert_settings ("institutionId")
    WHERE "institutionId" IS NOT NULL
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS attendance_recurrent_alerts (
      id SERIAL PRIMARY KEY,
      "institutionId" integer NOT NULL,
      "studentId" integer NOT NULL,
      "periodoKey" varchar(20) NOT NULL,
      "periodoTipo" varchar(20) NOT NULL DEFAULT 'mes',
      "periodoLabel" varchar(80) NOT NULL DEFAULT '',
      "nivelEducativo" varchar(30) NOT NULL DEFAULT '',
      modalidad varchar(20) NOT NULL DEFAULT 'todos',
      estado varchar(20) NOT NULL DEFAULT 'abierta',
      "nivelRiesgo" varchar(20) NOT NULL DEFAULT 'alerta',
      "faltasInjustificadas" integer NOT NULL DEFAULT 0,
      "diasConsecutivos" integer NOT NULL DEFAULT 0,
      "porcentajeInasistencia" numeric(5,2) NOT NULL DEFAULT 0,
      "motivoObservacion" text NOT NULL DEFAULT '',
      "derivadoARol" varchar(60) NOT NULL DEFAULT '',
      "derivadoAUsuario" varchar(120) NOT NULL DEFAULT '',
      "cerradoMotivo" text NOT NULL DEFAULT '',
      "justificationId" integer NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "closedAt" timestamp NULL
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_recurrent_alerts_inst_estado
    ON attendance_recurrent_alerts ("institutionId", estado, "periodoKey")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_recurrent_alerts_student
    ON attendance_recurrent_alerts ("studentId", "periodoKey")
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recurrent_alerts_open_unique
    ON attendance_recurrent_alerts ("studentId", "periodoKey", "institutionId")
    WHERE estado IN ('abierta', 'atendida', 'derivada')
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS attendance_recurrent_alert_actions (
      id SERIAL PRIMARY KEY,
      "alertId" integer NOT NULL,
      accion varchar(30) NOT NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      "valorAnterior" jsonb NULL,
      "valorNuevo" jsonb NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_recurrent_alert_actions_alert
    ON attendance_recurrent_alert_actions ("alertId", "createdAt" DESC)
  `);
}
