import { DataSource } from 'typeorm';

export async function prepareAniosEscolaresTables(ds: DataSource): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS maestros_anios_escolares (
      id SERIAL PRIMARY KEY,
      "institutionId" integer NOT NULL,
      anio integer NOT NULL,
      "fechaInicio" date NOT NULL,
      "fechaFin" date NOT NULL,
      "tipoPeriodo" varchar(20) NOT NULL DEFAULT 'bimestre',
      estado varchar(20) NOT NULL DEFAULT 'planificado',
      vigente boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1,
      publicado boolean NOT NULL DEFAULT false,
      motivo text NOT NULL DEFAULT '',
      "idempotencyKey" varchar(64) NULL,
      activo boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_maestros_anios_escolares_inst_anio
    ON maestros_anios_escolares ("institutionId", anio)
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_maestros_anios_escolares_idempotency
    ON maestros_anios_escolares ("institutionId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS maestros_anio_escolar_eventos (
      id SERIAL PRIMARY KEY,
      "anioEscolarId" integer NOT NULL,
      accion varchar(30) NOT NULL,
      "estadoAnterior" varchar(20) NULL,
      "estadoNuevo" varchar(20) NULL,
      motivo text NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_maestros_anio_escolar_eventos_anio
    ON maestros_anio_escolar_eventos ("anioEscolarId", "createdAt" DESC)
  `);

  await ds.query(`
    INSERT INTO permissions (codigo, label, modulo, icono, orden)
    SELECT v.codigo, v.label, 'Calendarización', 'calendar_month', v.orden
    FROM (VALUES
      ('calendarizacion.ver', 'Consultar calendarización escolar', 210),
      ('calendarizacion.gestionar', 'Registrar y activar años escolares', 211)
    ) AS v(codigo, label, orden)
    WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.codigo = v.codigo)
  `);

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.codigo IN ('ADMIN', 'DIRECTOR') AND p.codigo LIKE 'calendarizacion.%')
      OR (r.codigo = 'SECRETARIA' AND p.codigo = 'calendarizacion.ver')
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
    )
  `);
}
