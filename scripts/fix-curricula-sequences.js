const { Client } = require('pg');

const TABLE_RENAMES = [
  ['curriculum_areas', 'curricula_areas'],
  ['curriculum_subjects', 'curricula_subjects'],
  ['curriculum_competencias', 'curricula_competencias'],
  ['curriculum_capacidades', 'curricula_capacidades'],
  ['curriculum_indicadores', 'curricula_indicadores'],
  ['curriculum_teacher_assignments', 'curricula_teacher_assignments'],
];

const CURRICULA_TABLES = ['curricula', ...TABLE_RENAMES.map(([, to]) => to)];

function parseDefaultSequence(columnDefault) {
  if (!columnDefault) return null;
  const match = columnDefault.match(/nextval\('([^']+)'::regclass\)/);
  return match?.[1] ?? null;
}

async function sequenceExists(c, name) {
  const r = await c.query(
    "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname=$1) AS exists",
    [name],
  );
  return r.rows[0].exists;
}

async function reconcile(c, table) {
  if (table === 'curricula') return;

  const expectedSeq = `${table}_id_seq`;
  const legacySeq = `${table.replace(/^curricula_/, 'curriculum_')}_id_seq`;

  const col = await c.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name='id'`,
    [table],
  );
  const defaultSeq = parseDefaultSequence(col.rows[0]?.column_default);

  const legacyExists = await sequenceExists(c, legacySeq);
  const defaultExists = defaultSeq ? await sequenceExists(c, defaultSeq) : false;

  if (legacyExists && defaultExists && legacySeq !== defaultSeq) {
    await c.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${legacySeq}'::regclass)`,
    );
    await c.query(`DROP SEQUENCE IF EXISTS "${defaultSeq}"`);
    await c.query(`ALTER SEQUENCE "${legacySeq}" RENAME TO "${expectedSeq}"`);
    await c.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${expectedSeq}'::regclass)`,
    );
    console.log(`reconciled ${table}: dropped ${defaultSeq}, renamed ${legacySeq} -> ${expectedSeq}`);
    return;
  }

  if (legacyExists && !defaultExists) {
    await c.query(`ALTER SEQUENCE "${legacySeq}" RENAME TO "${expectedSeq}"`);
    await c.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${expectedSeq}'::regclass)`,
    );
    console.log(`reconciled ${table}: renamed ${legacySeq} -> ${expectedSeq}`);
  }
}

async function reset(c, table) {
  const col = await c.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name='id'`,
    [table],
  );
  const seq = parseDefaultSequence(col.rows[0]?.column_default);
  if (!seq) {
    console.log(`skip ${table}: no sequence in default`);
    return;
  }

  const stats = await c.query(
    `SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*)::int AS row_count FROM "${table}"`,
  );
  const maxId = Number(stats.rows[0].max_id);
  const hasRows = stats.rows[0].row_count > 0;

  await c.query('SELECT setval($1, GREATEST($2, 1), $3)', [seq, maxId, hasRows]);
  const lv = await c.query(`SELECT last_value, is_called FROM "${seq}"`);
  console.log(`reset ${table}: seq=${seq} max_id=${maxId}`, lv.rows[0]);
}

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'escolar',
  });
  await c.connect();

  for (const table of CURRICULA_TABLES) {
    await reconcile(c, table);
  }
  for (const table of CURRICULA_TABLES) {
    await reset(c, table);
  }

  await c.end();
  console.log('Listo.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
