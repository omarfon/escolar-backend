/**
 * Carga asistencia demo en PostgreSQL desde scripts/asistencia-control-data.sql
 * Uso: npm run db:asistencia-data
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

  const sqlPath = join(__dirname, 'asistencia-control-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{
      junio: string;
      julio: string;
      faltas: string;
      tardanzas: string;
      justificadas: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM attendances WHERE TO_CHAR(fecha, 'YYYY-MM') = '2026-06') AS junio,
        (SELECT COUNT(*)::text FROM attendances WHERE TO_CHAR(fecha, 'YYYY-MM') = '2026-07') AS julio,
        (SELECT COUNT(*)::text FROM attendances WHERE estado = 'F' AND fecha >= '2026-06-01') AS faltas,
        (SELECT COUNT(*)::text FROM attendances WHERE estado = 'T' AND fecha >= '2026-06-01') AS tardanzas,
        (SELECT COUNT(*)::text FROM attendances WHERE estado = 'J' AND fecha >= '2026-06-01') AS justificadas
    `);
    const c = rows[0];
    console.log('Asistencia cargada en PostgreSQL (Control de Faltas):');
    console.log(`  Registros junio 2026:  ${c.junio}`);
    console.log(`  Registros julio 2026:  ${c.julio}`);
    console.log(`  Faltas (F):            ${c.faltas}`);
    console.log(`  Tardanzas (T):         ${c.tardanzas}`);
    console.log(`  Justificadas (J):      ${c.justificadas}`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar asistencia:', err.message);
  process.exit(1);
});
