import { DataSource } from 'typeorm';

/** Índice en createdAt para consultas y purga eficiente de la bitácora. */
export async function prepareAuditLogsTable(ds: DataSource): Promise<void> {
  const [{ exists }] = await ds.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ) AS exists`,
  );
  if (!exists) return;

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs ("createdAt")
  `);

  await ds.query(`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS resultado varchar(10) NOT NULL DEFAULT 'success'
  `);

  await ds.query(`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS "correlationId" varchar(64) NULL
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_access
    ON audit_logs (accion, modulo, "createdAt" DESC)
    WHERE accion IN ('login', 'logout')
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
    ON audit_logs ("correlationId")
    WHERE "correlationId" IS NOT NULL
  `);

  await ds.query(`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS "institutionId" integer NULL
  `);

  await backfillAuditLogsInstitutionId(ds);
}

/** Backfill IE en bitácora histórica (asignaciones RBAC → IE default). */
async function backfillAuditLogsInstitutionId(ds: DataSource): Promise<void> {
  const hasAssignments = await ds.query<{ exists: boolean }[]>(
    `SELECT to_regclass('public.user_role_assignments') IS NOT NULL AS exists`,
  );
  if (hasAssignments[0]?.exists) {
    await ds.query(`
      UPDATE audit_logs al
      SET "institutionId" = sub."institutionId"
      FROM (
        SELECT DISTINCT ON (ura."userId")
          ura."userId",
          ura."institutionId"
        FROM user_role_assignments ura
        WHERE ura.activo = true
          AND ura."institutionId" IS NOT NULL
        ORDER BY ura."userId", ura."esPrincipal" DESC, ura."createdAt" ASC
      ) sub
      WHERE al."usuarioId" = sub."userId"
        AND al."institutionId" IS NULL
    `);
  }

  const defaultRows = await ds.query<Array<{ id: number }>>(
    `SELECT id FROM institutions ORDER BY id ASC LIMIT 1`,
  );
  const defaultIe = defaultRows[0]?.id;
  if (defaultIe == null) return;

  await ds.query(
    `UPDATE audit_logs SET "institutionId" = $1 WHERE "institutionId" IS NULL`,
    [defaultIe],
  );

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_created
    ON audit_logs ("institutionId", "createdAt" DESC)
    WHERE "institutionId" IS NOT NULL
  `);
}
