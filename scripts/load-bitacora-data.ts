/**
 * Carga registros demo de bitácora en PostgreSQL desde scripts/bitacora-data.sql
 * Uso: npm run db:bitacora-data
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

async function main(): Promise<void> {
  const client = new Client({
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', '5433')),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', 'postgres'),
    database: env('DB_NAME', 'escolar'),
  });

  const sqlPath = join(__dirname, 'bitacora-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{
      total: string;
      ultimos_15_dias: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM audit_logs) AS total,
        (SELECT COUNT(*)::text FROM audit_logs
         WHERE "createdAt" >= NOW() - INTERVAL '15 days') AS ultimos_15_dias
    `);
    const counts = rows[0];
    console.log('Bitácora cargada en PostgreSQL:');
    console.log(`  registros (total):           ${counts.total} filas`);
    console.log(`  registros (últimos 15 días): ${counts.ultimos_15_dias} filas`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar bitácora:', err.message);
  process.exit(1);
});
