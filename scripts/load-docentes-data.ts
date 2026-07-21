/**
 * Carga docentes demo en PostgreSQL desde scripts/docentes-data.sql
 * Uso: npm run db:docentes-data
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

  const sqlPath = join(__dirname, 'docentes-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{ docentes: string; activos: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM docentes) AS docentes,
        (SELECT COUNT(*)::text FROM docentes WHERE estado = 'activo') AS activos
    `);
    const counts = rows[0];
    console.log('Docentes cargados en PostgreSQL:');
    console.log(`  docentes (total):  ${counts.docentes} filas`);
    console.log(`  docentes (activos): ${counts.activos} filas`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar docentes:', err.message);
  process.exit(1);
});
