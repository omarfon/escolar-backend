/**
 * Carga datos académicos demo en PostgreSQL desde scripts/academic-data.sql
 * Uso: npm run db:academic-data
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

  const sqlPath = join(__dirname, 'academic-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{ historial: string; notas: string; asistencia: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM student_academic_history) AS historial,
        (SELECT COUNT(*)::text FROM grades) AS notas,
        (SELECT COUNT(*)::text FROM attendances) AS asistencia
    `);
    const counts = rows[0];
    console.log('Datos académicos cargados en PostgreSQL:');
    console.log(`  student_academic_history: ${counts.historial} filas`);
    console.log(`  grades:                 ${counts.notas} filas`);
    console.log(`  attendances:            ${counts.asistencia} filas`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar datos académicos:', err.message);
  process.exit(1);
});
