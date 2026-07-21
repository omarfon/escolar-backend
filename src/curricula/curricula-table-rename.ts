import { DataSource } from 'typeorm';

/** Renombra tablas legacy curriculum_* → curricula_* preservando datos. */
const TABLE_RENAMES: [string, string][] = [
  ['curriculum_areas', 'curricula_areas'],
  ['curriculum_subjects', 'curricula_subjects'],
  ['curriculum_competencias', 'curricula_competencias'],
  ['curriculum_capacidades', 'curricula_capacidades'],
  ['curriculum_indicadores', 'curricula_indicadores'],
  ['curriculum_teacher_assignments', 'curricula_teacher_assignments'],
];

const CURRICULA_TABLES = [
  'curricula',
  ...TABLE_RENAMES.map(([, to]) => to),
];

function parseDefaultSequence(columnDefault: string | null): string | null {
  if (!columnDefault) return null;
  const match = columnDefault.match(/nextval\('([^']+)'::regclass\)/);
  return match?.[1] ?? null;
}

async function tableExists(
  dataSource: DataSource,
  name: string,
): Promise<boolean> {
  const [{ exists }] = await dataSource.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [name],
  );
  return exists;
}

async function sequenceExists(
  dataSource: DataSource,
  name: string,
): Promise<boolean> {
  const [{ exists }] = await dataSource.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = $1
    ) AS exists`,
    [name],
  );
  return exists;
}

async function getIdColumnDefault(
  dataSource: DataSource,
  table: string,
): Promise<string | null> {
  const rows = await dataSource.query<{ column_default: string | null }[]>(
    `SELECT column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'`,
    [table],
  );
  return rows[0]?.column_default ?? null;
}

/** Unifica secuencias legacy curriculum_* con las nuevas curricula_* tras el rename. */
async function reconcileCurriculaSequences(
  dataSource: DataSource,
  table: string,
): Promise<void> {
  if (table === 'curricula') return;

  const expectedSeq = `${table}_id_seq`;
  const legacySeq = `${table.replace(/^curricula_/, 'curriculum_')}_id_seq`;
  const columnDefault = await getIdColumnDefault(dataSource, table);
  const defaultSeq = parseDefaultSequence(columnDefault);

  const legacyExists = await sequenceExists(dataSource, legacySeq);
  const defaultExists = defaultSeq
    ? await sequenceExists(dataSource, defaultSeq)
    : false;

  if (legacyExists && defaultExists && legacySeq !== defaultSeq) {
    await dataSource.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${legacySeq}'::regclass)`,
    );
    await dataSource.query(`DROP SEQUENCE IF EXISTS "${defaultSeq}"`);
    await dataSource.query(
      `ALTER SEQUENCE "${legacySeq}" RENAME TO "${expectedSeq}"`,
    );
    await dataSource.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${expectedSeq}'::regclass)`,
    );
    return;
  }

  if (legacyExists && !defaultExists) {
    await dataSource.query(
      `ALTER SEQUENCE "${legacySeq}" RENAME TO "${expectedSeq}"`,
    );
    await dataSource.query(
      `ALTER TABLE "${table}" ALTER COLUMN id SET DEFAULT nextval('${expectedSeq}'::regclass)`,
    );
  }
}

export async function renameLegacyCurriculaTables(
  dataSource: DataSource,
): Promise<void> {
  for (const [from, to] of TABLE_RENAMES) {
    const oldExists = await tableExists(dataSource, from);
    const newExists = await tableExists(dataSource, to);

    if (oldExists && !newExists) {
      await dataSource.query(`ALTER TABLE "${from}" RENAME TO "${to}"`);
      const seqFrom = `${from}_id_seq`;
      const seqTo = `${to}_id_seq`;
      if (await sequenceExists(dataSource, seqFrom)) {
        if (await sequenceExists(dataSource, seqTo)) {
          await dataSource.query(`DROP SEQUENCE IF EXISTS "${seqTo}"`);
        }
        await dataSource.query(
          `ALTER SEQUENCE "${seqFrom}" RENAME TO "${seqTo}"`,
        );
        await dataSource.query(
          `ALTER TABLE "${to}" ALTER COLUMN id SET DEFAULT nextval('${seqTo}'::regclass)`,
        );
      }
    }
  }

  for (const table of CURRICULA_TABLES) {
    await reconcileCurriculaSequences(dataSource, table);
  }

  await resetCurriculaIdSequences(dataSource);
}

/** Corrige secuencias de id usando el DEFAULT real de la columna (no pg_get_serial_sequence). */
export async function resetCurriculaIdSequences(
  dataSource: DataSource,
): Promise<void> {
  for (const table of CURRICULA_TABLES) {
    if (!(await tableExists(dataSource, table))) continue;
    await reconcileCurriculaSequences(dataSource, table);
  }

  for (const table of CURRICULA_TABLES) {
    if (!(await tableExists(dataSource, table))) continue;

    const columnDefault = await getIdColumnDefault(dataSource, table);
    const seq =
      parseDefaultSequence(columnDefault) ??
      parseDefaultSequence(
        (await dataSource.query<[{ seq: string | null }]>(
          `SELECT pg_get_serial_sequence('public."${table}"', 'id') AS seq`,
        ))[0]?.seq?.replace(/^public\./, '') ?? null,
      );

    if (!seq) continue;

    const [{ max_id, row_count }] = await dataSource.query<
      [{ max_id: string; row_count: string }]
    >(
      `SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*)::text AS row_count FROM "${table}"`,
    );
    const maxId = Number(max_id);
    const hasRows = Number(row_count) > 0;

    await dataSource.query(
      `SELECT setval($1, GREATEST($2, 1), $3)`,
      [seq, maxId, hasRows],
    );
  }
}
