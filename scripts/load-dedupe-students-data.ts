/**
 * Fusiona alumnos duplicados en PostgreSQL.
 * Uso: npm run db:dedupe-students
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

  const sqlPath = join(__dirname, 'dedupe-students-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    const before = await client.query<{ dup: string }>(`
      SELECT COUNT(*)::text AS dup
      FROM (
        SELECT 1
        FROM students
        WHERE activo = true AND COALESCE("estadoMatricula", 'activo') = 'activo'
        GROUP BY nivel, grado, upper(trim(seccion)), lower(trim(nombre)), lower(trim(apellido))
        HAVING COUNT(*) > 1
      ) q
    `);

    await client.query(sql);

    const after = await client.query<{ activos: string; dup: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM students WHERE activo = true AND COALESCE("estadoMatricula", 'activo') = 'activo') AS activos,
        (
          SELECT COUNT(*)::text
          FROM (
            SELECT 1
            FROM students
            WHERE activo = true AND COALESCE("estadoMatricula", 'activo') = 'activo'
            GROUP BY nivel, grado, upper(trim(seccion)), lower(trim(nombre)), lower(trim(apellido))
            HAVING COUNT(*) > 1
          ) q
        ) AS dup
    `);

    console.log('Limpieza de alumnos duplicados:');
    console.log(`  grupos duplicados antes:  ${before.rows[0].dup}`);
    console.log(`  alumnos activos ahora:    ${after.rows[0].activos}`);
    console.log(`  grupos duplicados ahora:  ${after.rows[0].dup}`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al deduplicar alumnos:', err.message);
  process.exit(1);
});
