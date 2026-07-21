/**
 * Carga salones, asignaciones docente y bloques de horario en PostgreSQL.
 * Períodos: scripts/horarios-data.sql
 *
 * Uso: npm run db:horarios-data
 * Requisitos previos:
 *   - npm run db:sedes-data (institución)
 *   - Backend iniciado al menos una vez (tablas TypeORM)
 *   - npm run db:docentes-data (docentes)
 *   - Currícula/cursos cargados (seed inicial o db dedicado)
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { HORARIO_ASSIGNMENTS_SEED } from '../src/horarios/horarios-assignments-seed.data';
import { HORARIO_BLOCKS_SEED } from '../src/horarios/horarios-blocks-seed.data';

const ANIO_ESCOLAR = Number(process.env.ANIO_ESCOLAR ?? 2026);

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function gradoInstitucionalToMatricula(nivel: string, nombreGrado: string): string {
  const t = nombreGrado.trim();
  const m = t.match(/^(\d+)/);
  if (m) return `${m[1]}°`;
  if (nivel === 'Inicial') {
    const ini = t.match(/^(\d+)/);
    if (ini) return `${ini[1]}°`;
  }
  return t;
}

function defaultAforo(nivel: string): number {
  if (nivel === 'Inicial') return 25;
  if (nivel === 'Secundaria') return 35;
  return 30;
}

async function ensureSectionBPrimaria5(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO grade_sections ("gradoId", nombre)
    SELECT gl.id, 'B'
    FROM grade_levels gl
    JOIN education_levels el ON el.id = gl."nivelId"
    WHERE el.nombre = 'Primaria'
      AND (gl.nombre ILIKE '%5%' OR gl.nombre ILIKE '5%')
      AND NOT EXISTS (
        SELECT 1 FROM grade_sections gs
        WHERE gs."gradoId" = gl.id AND UPPER(TRIM(gs.nombre)) = 'B'
      )
  `);
}

async function seedSalones(client: Client): Promise<number> {
  await ensureSectionBPrimaria5(client);

  const { rows: niveles } = await client.query<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM education_levels WHERE activo = true ORDER BY orden ASC`,
  );

  let created = 0;
  for (const nivel of niveles) {
    const { rows: grados } = await client.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM grade_levels WHERE "nivelId" = $1 ORDER BY orden ASC`,
      [nivel.id],
    );
    for (const grado of grados) {
      const gradoMat = gradoInstitucionalToMatricula(nivel.nombre, grado.nombre);
      const { rows: secciones } = await client.query<{ nombre: string }>(
        `SELECT nombre FROM grade_sections WHERE "gradoId" = $1`,
        [grado.id],
      );
      for (const sec of secciones) {
        const seccion = sec.nombre.trim().toUpperCase();
        const exists = await client.query(
          `SELECT 1 FROM salones
           WHERE "anioEscolar" = $1 AND nivel = $2 AND grado = $3 AND seccion = $4
           LIMIT 1`,
          [ANIO_ESCOLAR, nivel.nombre, gradoMat, seccion],
        );
        if (exists.rowCount) continue;

        await client.query(
          `INSERT INTO salones ("anioEscolar", nivel, grado, seccion, aforo, activo)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [ANIO_ESCOLAR, nivel.nombre, gradoMat, seccion, defaultAforo(nivel.nombre)],
        );
        created++;
      }
    }
  }
  return created;
}

async function seedAssignments(client: Client): Promise<number> {
  const { rows: curriculas } = await client.query<{ id: number; nivel: string }>(
    `SELECT id, nivel FROM curricula WHERE anio = $1 AND estado = 'activo'`,
    [ANIO_ESCOLAR],
  );
  const curriculumByNivel = new Map(curriculas.map((c) => [c.nivel, c.id]));

  const { rows: cursos } = await client.query<{
    id: number;
    nombre: string;
    nivel: string;
    horas: number;
  }>(`
    SELECT cs.id, cs.nombre, c.nivel, COALESCE(cs."horasSemanales", 0) AS horas
    FROM curricula_subjects cs
    JOIN curricula c ON c.id = cs."curriculumId"
    WHERE c.anio = $1
  `, [ANIO_ESCOLAR]);
  const cursoByKey = new Map<string, (typeof cursos)[0]>(
    cursos.map((c) => [`${c.nivel}|${c.nombre}`, c]),
  );

  const { rows: docentes } = await client.query<{
    id: number;
    username: string;
    nombres: string;
    apellidos: string;
  }>(`SELECT id, username, nombres, apellidos FROM docentes WHERE estado = 'activo'`);
  const docenteByUsername = new Map<string, (typeof docentes)[0]>(
    docentes.map((d) => [d.username, d]),
  );

  let upserted = 0;
  for (const seed of HORARIO_ASSIGNMENTS_SEED) {
    const docente = docenteByUsername.get(seed.docenteUsername);
    const curso = cursoByKey.get(`${seed.nivel}|${seed.cursoNombre}`);
    const curriculumId = curriculumByNivel.get(seed.nivel);
    if (!docente || !curso || !curriculumId) continue;

    const docenteNombre = `${docente.nombres} ${docente.apellidos}`;
    const seccionesJson = JSON.stringify(seed.secciones);

    const existing = await client.query<{ id: number; secciones: string[] }>(
      `SELECT id, secciones FROM curricula_teacher_assignments
       WHERE "cursoId" = $1 AND nivel = $2 AND grado = $3
         AND "docenteId" = $4 AND activo = true
       LIMIT 1`,
      [curso.id, seed.nivel, seed.grado, docente.id],
    );

    if (existing.rows[0]) {
      const merged = [...new Set([...existing.rows[0].secciones, ...seed.secciones])];
      await client.query(
        `UPDATE curricula_teacher_assignments
         SET secciones = $1::jsonb, "docenteNombre" = $2
         WHERE id = $3`,
        [JSON.stringify(merged), docenteNombre, existing.rows[0].id],
      );
      upserted++;
      continue;
    }

    const orphan = await client.query<{ id: number }>(
      `SELECT id FROM curricula_teacher_assignments
       WHERE "cursoId" = $1 AND nivel = $2 AND grado = $3 AND activo = true
         AND ("docenteId" IS NULL OR "docenteNombre" = $4)
       LIMIT 1`,
      [curso.id, seed.nivel, seed.grado, docenteNombre],
    );

    if (orphan.rows[0]) {
      await client.query(
        `UPDATE curricula_teacher_assignments
         SET "docenteId" = $1, "docenteNombre" = $2, secciones = $3::jsonb,
             "curriculumId" = $4
         WHERE id = $5`,
        [docente.id, docenteNombre, seccionesJson, curriculumId, orphan.rows[0].id],
      );
      upserted++;
      continue;
    }

    const exists = await client.query(
      `SELECT 1 FROM curricula_teacher_assignments
       WHERE "cursoId" = $1 AND nivel = $2 AND grado = $3
         AND "docenteId" = $4 AND activo = true
       LIMIT 1`,
      [curso.id, seed.nivel, seed.grado, docente.id],
    );
    if (!exists.rowCount) {
      await client.query(
        `INSERT INTO curricula_teacher_assignments (
           "docenteId", "docenteNombre", "cursoId", "curriculumId",
           nivel, grado, secciones, "horasSemanales", activo
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, true)`,
        [
          docente.id,
          docenteNombre,
          curso.id,
          curriculumId,
          seed.nivel,
          seed.grado,
          seccionesJson,
          curso.horas,
        ],
      );
    }
    upserted++;
  }
  return upserted;
}

async function seedBlocks(client: Client): Promise<number> {
  const { rows: periodos } = await client.query<{ id: number; orden: number }>(
    `SELECT id, orden FROM horario_periodos
     WHERE "anioEscolar" = $1 AND activo = true`,
    [ANIO_ESCOLAR],
  );
  const periodoByOrden = new Map(periodos.map((p) => [p.orden, p.id]));

  const { rows: cursos } = await client.query<{ id: number; nombre: string; nivel: string }>(`
    SELECT cs.id, cs.nombre, c.nivel
    FROM curricula_subjects cs
    JOIN curricula c ON c.id = cs."curriculumId"
    WHERE c.anio = $1
  `, [ANIO_ESCOLAR]);
  const cursoByKey = new Map<string, number>(
    cursos.map((c) => [`${c.nivel}|${c.nombre}`, c.id]),
  );

  const { rows: docentes } = await client.query<{ id: number; username: string }>(
    `SELECT id, username FROM docentes WHERE estado = 'activo'`,
  );
  const docenteByUsername = new Map<string, number>(
    docentes.map((d) => [d.username, d.id]),
  );

  let inserted = 0;
  for (const slot of HORARIO_BLOCKS_SEED) {
    const periodoId = periodoByOrden.get(slot.periodoOrden);
    const cursoId = cursoByKey.get(`${slot.nivel}|${slot.cursoNombre}`);
    const docenteId = docenteByUsername.get(slot.docenteUsername);
    if (!periodoId || !cursoId || !docenteId) continue;

    const exists = await client.query(
      `SELECT 1 FROM horario_blocks
       WHERE "anioEscolar" = $1 AND nivel = $2 AND grado = $3
         AND seccion = $4 AND dia = $5 AND "periodoId" = $6 AND activo = true
       LIMIT 1`,
      [ANIO_ESCOLAR, slot.nivel, slot.grado, slot.seccion, slot.dia, periodoId],
    );
    if (exists.rowCount) continue;

    await client.query(
      `INSERT INTO horario_blocks (
         "anioEscolar", nivel, grado, seccion, dia, "periodoId",
         "cursoId", "docenteId", activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [
        ANIO_ESCOLAR,
        slot.nivel,
        slot.grado,
        slot.seccion,
        slot.dia,
        periodoId,
        cursoId,
        docenteId,
      ],
    );
    inserted++;
  }
  return inserted;
}

async function main(): Promise<void> {
  const client = new Client({
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', '5433')),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', 'postgres'),
    database: env('DB_NAME', 'escolar'),
  });

  const sqlPath = join(__dirname, 'horarios-data.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);

    const salones = await seedSalones(client);
    const asignaciones = await seedAssignments(client);
    const bloques = await seedBlocks(client);

    await client.query('COMMIT');

    const { rows } = await client.query<{
      periodos: string;
      salones: string;
      asignaciones: string;
      bloques: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM horario_periodos WHERE "anioEscolar" = $1) AS periodos,
        (SELECT COUNT(*)::text FROM salones WHERE "anioEscolar" = $1 AND activo = true) AS salones,
        (SELECT COUNT(*)::text FROM curricula_teacher_assignments WHERE activo = true) AS asignaciones,
        (SELECT COUNT(*)::text FROM horario_blocks WHERE "anioEscolar" = $1 AND activo = true) AS bloques
    `, [ANIO_ESCOLAR]);

    console.log(`Horarios cargados en PostgreSQL (A.E. ${ANIO_ESCOLAR}):`);
    console.log(`  horario_periodos:              ${rows[0].periodos} filas`);
    console.log(`  salones (nuevos insertados):   ${salones}`);
    console.log(`  salones (total activos):       ${rows[0].salones} filas`);
    console.log(`  asignaciones docente (upsert): ${asignaciones}`);
    console.log(`  asignaciones (total activas):  ${rows[0].asignaciones} filas`);
    console.log(`  horario_blocks (nuevos):       ${bloques}`);
    console.log(`  horario_blocks (total activos): ${rows[0].bloques} filas`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar horarios:', err.message);
  process.exit(1);
});
