/**
 * Carga sedes demo en PostgreSQL desde scripts/sedes-data.sql
 * Uso: npm run db:sedes-data
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

  const sqlPath = join(__dirname, 'sedes-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{
      sedes: string;
      activas: string;
      institucion: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM sedes) AS sedes,
        (SELECT COUNT(*)::text FROM sedes WHERE estado = 'activo') AS activas,
        (SELECT nombre FROM institutions ORDER BY id ASC LIMIT 1) AS institucion
    `);
    const counts = rows[0];
    console.log('Sedes cargadas en PostgreSQL:');
    console.log(`  institución:         ${counts.institucion ?? '(sin institución)'}`);
    console.log(`  sedes (total):       ${counts.sedes} filas`);
    console.log(`  sedes (activas):     ${counts.activas} filas`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar sedes:', err.message);
  process.exit(1);
});
