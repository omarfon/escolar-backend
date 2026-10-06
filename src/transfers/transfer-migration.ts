import { DataSource } from 'typeorm';

export async function prepareTransferRequestsTables(ds: DataSource): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS transfer_requests (
      id SERIAL PRIMARY KEY,
      codigo varchar(20) NOT NULL DEFAULT '',
      "studentId" integer NOT NULL,
      "studentCodigo" varchar(20) NOT NULL DEFAULT '',
      "studentNombre" varchar(180) NOT NULL DEFAULT '',
      "studentDni" varchar(20) NOT NULL DEFAULT '',
      "anioEscolar" integer NOT NULL,
      estado varchar(20) NOT NULL DEFAULT 'borrador',
      "ieOrigenNombre" varchar(200) NOT NULL DEFAULT '',
      "ieOrigenCodigoModular" varchar(20) NOT NULL DEFAULT '',
      "ieOrigenUgel" varchar(80) NOT NULL DEFAULT '',
      "ieOrigenDre" varchar(80) NOT NULL DEFAULT '',
      "ieDestinoNombre" varchar(200) NOT NULL,
      "ieDestinoCodigoModular" varchar(20) NOT NULL,
      "ieDestinoUgel" varchar(80) NOT NULL,
      "ieDestinoDre" varchar(80) NOT NULL,
      motivo text NOT NULL,
      observacion text NOT NULL DEFAULT '',
      "plazoHasta" date NOT NULL,
      evidencia text NOT NULL,
      "idempotencyKey" varchar(64) NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_codigo
    ON transfer_requests (codigo)
    WHERE codigo <> ''
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_idempotency
    ON transfer_requests ("idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_activo
    ON transfer_requests ("studentId", "anioEscolar", "ieDestinoCodigoModular")
    WHERE estado IN ('borrador', 'enviada', 'observada', 'aprobada')
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_transfer_requests_student
    ON transfer_requests ("studentId")
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS transfer_request_events (
      id SERIAL PRIMARY KEY,
      "transferRequestId" integer NOT NULL,
      accion varchar(20) NOT NULL,
      "estadoAnterior" varchar(20) NULL,
      "estadoNuevo" varchar(20) NOT NULL,
      motivo text NOT NULL DEFAULT '',
      observacion text NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_transfer_request_events_request
    ON transfer_request_events ("transferRequestId", "createdAt")
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS transfer_notifications (
      id SERIAL PRIMARY KEY,
      "transferRequestId" integer NOT NULL,
      plantilla varchar(60) NOT NULL DEFAULT '',
      ambito varchar(20) NOT NULL,
      destinatario varchar(200) NOT NULL DEFAULT '',
      mensaje text NOT NULL,
      "estadoAnterior" varchar(20) NULL,
      "estadoNuevo" varchar(20) NOT NULL DEFAULT '',
      "estadoEntrega" varchar(20) NOT NULL DEFAULT 'pendiente',
      intentos integer NOT NULL DEFAULT 0,
      "maxIntentos" integer NOT NULL DEFAULT 3,
      "ultimoError" text NOT NULL DEFAULT '',
      "idempotencyKey" varchar(180) NULL,
      leida boolean NOT NULL DEFAULT false,
      "entregadoAt" timestamp NULL,
      "leidoAt" timestamp NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS plantilla varchar(60) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "estadoAnterior" varchar(20) NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "estadoNuevo" varchar(20) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "estadoEntrega" varchar(20) NOT NULL DEFAULT 'pendiente'
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS intentos integer NOT NULL DEFAULT 0
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "maxIntentos" integer NOT NULL DEFAULT 3
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "ultimoError" text NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(180) NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "entregadoAt" timestamp NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications ADD COLUMN IF NOT EXISTS "leidoAt" timestamp NULL
  `);

  await ds.query(`
    UPDATE transfer_notifications
    SET plantilla = 'traslado_cambio_estado_origen',
        "estadoEntrega" = 'entregado',
        "entregadoAt" = COALESCE("entregadoAt", "createdAt"),
        intentos = GREATEST(intentos, 1)
    WHERE plantilla = '' OR plantilla IS NULL
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_transfer_notifications_request
    ON transfer_notifications ("transferRequestId", "createdAt" DESC)
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_notifications_idempotency
    ON transfer_notifications ("transferRequestId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL
  `);

  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "evidenciaTipo" varchar(20) NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "evidenciaDocumentId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "evidenciaReferencia" varchar(200) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "seccionDestino" varchar(10) NULL
  `);

  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioTipo" varchar(20) NOT NULL DEFAULT 'usuario'
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioUserId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioEmail" varchar(120) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioInstitutionId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioAmbitoNivel" varchar(20) NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "destinatarioRol" varchar(30) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "canalEntrega" varchar(20) NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "correoSimulado" boolean NOT NULL DEFAULT false
  `);
  await ds.query(`
    ALTER TABLE transfer_notifications
    ADD COLUMN IF NOT EXISTS "correoMessageId" varchar(120) NOT NULL DEFAULT ''
  `);

  await ds.query(`
    UPDATE transfer_notifications
    SET "correoSimulado" = true,
        "ultimoError" = CASE
          WHEN COALESCE("ultimoError", '') = '' THEN 'Entrega legacy simulada. Reintente o marque leída in-app.'
          ELSE "ultimoError"
        END
    WHERE "estadoEntrega" = 'entregado'
      AND "canalEntrega" IS NULL
      AND "destinatarioUserId" IS NULL
  `);

  await ds.query(`
    INSERT INTO permissions (codigo, label, modulo, icono, orden)
    SELECT v.codigo, v.label, 'Traslados', 'swap_horiz', v.orden
    FROM (VALUES
      ('traslados.ver', 'Consultar solicitudes de traslado', 200),
      ('traslados.solicitar', 'Solicitar traslado desde la IE de origen', 201),
      ('traslados.resolver', 'Observar, aprobar o rechazar traslado', 202),
      ('traslados.aprobar_destino', 'Aprobar o rechazar traslado en la IE de destino', 203)
    ) AS v(codigo, label, orden)
    WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.codigo = v.codigo)
  `);

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.codigo IN ('ADMIN', 'DIRECTOR') AND p.codigo LIKE 'traslados.%')
      OR (r.codigo = 'SECRETARIA' AND p.codigo IN ('traslados.ver', 'traslados.solicitar', 'traslados.aprobar_destino'))
      OR (r.codigo IN ('UGEL', 'DRE', 'MINEDU') AND p.codigo IN ('traslados.ver', 'traslados.resolver'))
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
    )
  `);
}
