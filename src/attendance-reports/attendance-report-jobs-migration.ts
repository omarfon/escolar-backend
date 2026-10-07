import type { DataSource } from 'typeorm';

export async function prepareAttendanceReportJobsTable(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS attendance_report_jobs (
      id SERIAL PRIMARY KEY,
      "institutionId" INTEGER NOT NULL,
      "scopeKey" VARCHAR(128) NOT NULL DEFAULT '',
      "reportType" VARCHAR(32) NOT NULL,
      format VARCHAR(8) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      filtros JSONB NOT NULL DEFAULT '{}',
      "totalFilas" INTEGER NOT NULL DEFAULT 0,
      "archivoPath" VARCHAR(512),
      "archivoNombre" VARCHAR(255),
      "errorMensaje" TEXT,
      "solicitadoPor" INTEGER,
      "solicitadoPorNombre" VARCHAR(120),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMPTZ
    )
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_att_report_jobs_scope_status
    ON attendance_report_jobs ("scopeKey", status, "createdAt" DESC)
  `);
}
