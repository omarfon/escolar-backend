/**
 * Carga conceptos de pago en PostgreSQL desde scripts/treasury-concepts-data.sql
 * Uso: npm run db:treasury-concepts-data
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

  const sqlPath = join(__dirname, 'treasury-concepts-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(`
      ALTER TABLE payment_concepts
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
    `);
    await client.query(sql);
    const { rows } = await client.query<{ total: string; activos: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM payment_concepts) AS total,
        (SELECT COUNT(*)::text FROM payment_concepts WHERE activo = true) AS activos
    `);
    console.log('Conceptos de pago cargados en PostgreSQL:');
    console.log(`  total:   ${rows[0].total} filas`);
    console.log(`  activos: ${rows[0].activos} filas`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
