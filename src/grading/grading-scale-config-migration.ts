import { DataSource } from 'typeorm';

export async function prepareGradingScaleConfigTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS grading_scale_config_history (
      id SERIAL PRIMARY KEY,
      "institutionId" integer NOT NULL,
      alcance varchar(30) NOT NULL,
      "curriculumId" integer NULL,
      nivel varchar(30) NOT NULL DEFAULT '',
      accion varchar(30) NOT NULL DEFAULT 'actualizar',
      "valorAnterior" jsonb NULL,
      "valorNuevo" jsonb NOT NULL,
      motivo text NOT NULL DEFAULT '',
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_grading_scale_history_inst
    ON grading_scale_config_history ("institutionId", "createdAt" DESC)
  `);

  await ds.query(`
    INSERT INTO permissions (codigo, label, modulo, icono, orden)
    SELECT v.codigo, v.label, 'Evaluación', 'tune', v.orden
    FROM (VALUES
      ('evaluacion.configurar', 'Configurar escalas de evaluación', 175)
    ) AS v(codigo, label, orden)
    WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.codigo = v.codigo)
  `);

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.codigo = 'evaluacion.configurar'
    WHERE r.codigo IN ('ADMIN', 'DIRECTOR', 'SIAGIE')
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
      )
  `);
}
