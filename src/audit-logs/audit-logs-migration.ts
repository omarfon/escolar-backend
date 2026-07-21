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
}
