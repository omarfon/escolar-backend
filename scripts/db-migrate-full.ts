/**
 * Migración completa de PostgreSQL: esquema TypeORM + migraciones SQL + seed + datos demo.
 *
 * Uso directo (BD ya levantada):
 *   npx ts-node scripts/db-migrate-full.ts
 *
 * Recomendado (Windows, incluye Docker):
 *   npm run db:migrate:full
 *   npm run db:migrate:full:reset   ← volumen limpio + carga total
 */
import 'reflect-metadata';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseSeedService } from '../src/database/database-seed.service';

const ROOT = join(__dirname, '..');

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

/** Si la consulta devuelve >= minRows, se omite el cargador (re-ejecución segura). */
const SKIP_IF_POPULATED: Record<string, { sql: string; minRows: number }> = {
  'db:sedes-data': { sql: 'SELECT COUNT(*)::int AS c FROM sedes', minRows: 1 },
  'db:docentes-data': { sql: 'SELECT COUNT(*)::int AS c FROM docentes', minRows: 5 },
  'db:horarios-data': {
    sql: 'SELECT COUNT(*)::int AS c FROM horario_blocks',
    minRows: 1,
  },
  'db:academic-data': { sql: 'SELECT COUNT(*)::int AS c FROM grades', minRows: 10 },
  'db:asistencia-data': {
    sql: 'SELECT COUNT(*)::int AS c FROM attendances',
    minRows: 50,
  },
  'db:registro-notas-data': {
    sql: 'SELECT COUNT(*)::int AS c FROM grades',
    minRows: 50,
  },
  'db:treasury-concepts-data': {
    sql: 'SELECT COUNT(*)::int AS c FROM payment_concepts',
    minRows: 1,
  },
};

const DATA_LOADERS: Array<{ label: string; npmScript: string }> = [
  { label: 'Sedes e institución', npmScript: 'db:sedes-data' },
  { label: 'Docentes', npmScript: 'db:docentes-data' },
  { label: 'Salones, horarios y asignaciones', npmScript: 'db:horarios-data' },
  { label: 'Historial, notas y asistencia académica', npmScript: 'db:academic-data' },
  { label: 'Control de asistencia (ampliado)', npmScript: 'db:asistencia-data' },
  { label: 'Registro de notas', npmScript: 'db:registro-notas-data' },
  { label: 'Bitácora docente', npmScript: 'db:bitacora-data' },
  { label: 'Temario de clases', npmScript: 'db:temario-data' },
  { label: 'Conceptos de tesorería', npmScript: 'db:treasury-concepts-data' },
  { label: 'Cobros y pagos', npmScript: 'db:treasury-data' },
  { label: 'Promedios', npmScript: 'db:promedios-data' },
  { label: 'Eventos institucionales', npmScript: 'db:events-data' },
  { label: 'Entregas de tareas (demo)', npmScript: 'db:entregas-data' },
  { label: 'Perfiles de estudiante', npmScript: 'db:student-profiles' },
  { label: 'Documentos de estudiante', npmScript: 'db:student-documents' },
  { label: 'Vínculos padre–estudiante', npmScript: 'db:parent-links' },
  { label: 'Deduplicación de estudiantes', npmScript: 'db:dedupe-students' },
];

function runNpmScript(script: string): void {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', script], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`Falló npm run ${script} (código ${result.status ?? 'desconocido'})`);
  }
}

async function migrateSchema(): Promise<void> {
  console.log('\n[1/3] Esquema TypeORM + migraciones SQL personalizadas…');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  await app.close();
  console.log('      Esquema aplicado.\n');
}

async function runBaseSeed(): Promise<void> {
  console.log('[2/3] Seed base (estudiantes, usuarios, roles, lista de espera…)…');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.get(DatabaseSeedService).runSeed();
    console.log('      Seed base completado.\n');
  } finally {
    await app.close();
  }
}

async function createPgClient(): Promise<Client> {
  const client = new Client({
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '5433')),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', 'postgres'),
    database: env('DB_NAME', 'escolar'),
  });
  await client.connect();
  return client;
}

async function isLoaderSkipped(
  client: Client,
  npmScript: string,
): Promise<boolean> {
  const rule = SKIP_IF_POPULATED[npmScript];
  if (!rule) return false;
  try {
    const { rows } = await client.query<{ c: number }>(rule.sql);
    return (rows[0]?.c ?? 0) >= rule.minRows;
  } catch {
    return false;
  }
}

async function runDataLoaders(): Promise<void> {
  console.log('[3/3] Cargadores SQL y datos complementarios…');
  const client = await createPgClient();
  try {
    for (let i = 0; i < DATA_LOADERS.length; i++) {
      const step = DATA_LOADERS[i];
      if (await isLoaderSkipped(client, step.npmScript)) {
        console.log(
          `      (${i + 1}/${DATA_LOADERS.length}) ${step.label}… omitido (ya cargado)`,
        );
        continue;
      }
      console.log(`      (${i + 1}/${DATA_LOADERS.length}) ${step.label}…`);
      try {
        runNpmScript(step.npmScript);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${msg}\n\nSugerencia: use npm run db:migrate:full:reset para una BD limpia.`,
        );
      }
    }
  } finally {
    await client.end();
  }
  console.log('');
}

async function printSummary(): Promise<void> {
  const client = await createPgClient();
  try {
    const { rows } = await client.query<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*)::text FROM students) AS estudiantes,
        (SELECT COUNT(*)::text FROM users) AS usuarios,
        (SELECT COUNT(*)::text FROM docentes) AS docentes,
        (SELECT COUNT(*)::text FROM salones) AS salones,
        (SELECT COUNT(*)::text FROM grades) AS notas,
        (SELECT COUNT(*)::text FROM attendances) AS asistencias,
        (SELECT COUNT(*)::text FROM waitlist_entries) AS lista_espera,
        (SELECT COUNT(*)::text FROM enrollment_evaluations) AS evaluaciones_matricula,
        (SELECT COUNT(*)::text FROM student_documents) AS documentos,
        (SELECT COUNT(*)::text FROM audit_logs) AS auditoria
    `);
    const s = rows[0];
    console.log('══════════════════════════════════════════════════════');
    console.log('  Migración completa — resumen');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  Estudiantes:           ${s.estudiantes}`);
    console.log(`  Usuarios:              ${s.usuarios}`);
    console.log(`  Docentes:              ${s.docentes}`);
    console.log(`  Salones:               ${s.salones}`);
    console.log(`  Notas:                 ${s.notas}`);
    console.log(`  Asistencias:           ${s.asistencias}`);
    console.log(`  Lista de espera:       ${s.lista_espera}`);
    console.log(`  Evaluaciones matrícula:${s.evaluaciones_matricula}`);
    console.log(`  Documentos:            ${s.documentos}`);
    console.log(`  Registros auditoría:   ${s.auditoria}`);
    console.log('══════════════════════════════════════════════════════');
    console.log('  Usuarios demo: admin / admin123 · r.huanca / admin123');
    console.log('══════════════════════════════════════════════════════\n');
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log('Escolar — migración completa de base de datos');
  console.log(
    `Destino: ${env('DB_HOST', '127.0.0.1')}:${env('DB_PORT', '5433')}/${env('DB_NAME', 'escolar')}\n`,
  );

  await migrateSchema();
  await runBaseSeed();
  await runDataLoaders();
  await printSummary();

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Listo en ${secs}s.`);
}

main().catch((err: Error) => {
  console.error('\nError en migración completa:', err.message);
  process.exit(1);
});
