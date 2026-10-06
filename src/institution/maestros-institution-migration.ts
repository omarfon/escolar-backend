import { DataSource } from 'typeorm';

/** Tablas maestras que quedan acotadas a una IE (NOT NULL tras backfill). */
const TABLAS_MAESTROS_OBLIGATORIAS = [
  'maestros_feriados',
  'salones',
  'docentes',
  'maestros_cursos',
  'maestros_periodos_academicos',
  'maestros_formulas_evaluacion',
  'maestros_conducta_tipos',
  'curricula',
  'schedules',
] as const;

/**
 * Añade institutionId a catálogos maestros, currícula y horarios.
 * Backfill con la IE mínima existente (solo migración; no runtime).
 */
export async function prepareMaestrosInstitutionColumns(ds: DataSource): Promise<void> {
  const defaultIe = await resolveDefaultInstitutionId(ds);
  if (defaultIe == null) return;

  for (const table of TABLAS_MAESTROS_OBLIGATORIAS) {
    if (!(await tableExists(ds, table))) continue;
    await addInstitutionColumn(ds, table);
    await backfillInstitutionId(ds, table, defaultIe);
    await setInstitutionNotNull(ds, table);
    await createInstitutionListIndex(ds, table);
  }

  await rebuildMaestrosUniqueIndexes(ds);

  if (await tableExists(ds, 'audit_logs')) {
    await addInstitutionColumn(ds, 'audit_logs');
    await createInstitutionListIndex(ds, 'audit_logs');
  }
}

async function resolveDefaultInstitutionId(ds: DataSource): Promise<number | null> {
  const rows: Array<{ id: number }> = await ds.query(
    `SELECT id FROM institutions ORDER BY id ASC LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(`SELECT to_regclass($1) AS nombre`, [`public.${table}`]);
  return Boolean(rows[0]?.nombre);
}

async function addInstitutionColumn(ds: DataSource, table: string): Promise<void> {
  await ds.query(`
    ALTER TABLE ${table}
    ADD COLUMN IF NOT EXISTS "institutionId" integer NULL
  `);
}

async function backfillInstitutionId(
  ds: DataSource,
  table: string,
  defaultIe: number,
): Promise<void> {
  if (table === 'schedules') {
    await ds.query(`
      UPDATE schedules s
      SET "institutionId" = st."institutionId"
      FROM students st
      WHERE s."studentId" = st.id
        AND s."institutionId" IS NULL
        AND st."institutionId" IS NOT NULL
    `);
  }

  await ds.query(`
    UPDATE ${table}
    SET "institutionId" = $1
    WHERE "institutionId" IS NULL
  `, [defaultIe]);
}

async function setInstitutionNotNull(ds: DataSource, table: string): Promise<void> {
  await ds.query(`
    ALTER TABLE ${table}
    ALTER COLUMN "institutionId" SET NOT NULL
  `);
}

async function createInstitutionListIndex(ds: DataSource, table: string): Promise<void> {
  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_${table}_institution
    ON ${table} ("institutionId")
  `);
}

async function rebuildMaestrosUniqueIndexes(ds: DataSource): Promise<void> {
  if (await tableExists(ds, 'maestros_feriados')) {
    await dropUniqueIndexesOnColumns(ds, 'maestros_feriados', ['anioEscolar', 'fecha']);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_maestros_feriados_ie_anio_fecha
      ON maestros_feriados ("institutionId", "anioEscolar", fecha)
    `);
  }

  if (await tableExists(ds, 'salones')) {
    await dropUniqueIndexesOnColumns(ds, 'salones', [
      'anioEscolar',
      'nivel',
      'grado',
      'seccion',
    ]);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_salones_ie_salon
      ON salones ("institutionId", "anioEscolar", nivel, grado, seccion)
    `);
  }

  if (await tableExists(ds, 'docentes')) {
    await dropUniqueConstraintsOnColumns(ds, 'docentes', ['dni', 'email', 'username']);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_ie_dni
      ON docentes ("institutionId", dni)
    `);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_ie_email
      ON docentes ("institutionId", email)
    `);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_ie_username
      ON docentes ("institutionId", username)
    `);
  }

  if (await tableExists(ds, 'maestros_periodos_academicos')) {
    await dropUniqueIndexesOnColumns(ds, 'maestros_periodos_academicos', [
      'anioEscolar',
      'numero',
    ]);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_maestros_periodos_ie_anio_num
      ON maestros_periodos_academicos ("institutionId", "anioEscolar", numero)
    `);
  }

  if (await tableExists(ds, 'maestros_conducta_tipos')) {
    await dropUniqueConstraintsOnColumns(ds, 'maestros_conducta_tipos', ['codigo']);
    await ds.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_maestros_conducta_tipos_ie_codigo
      ON maestros_conducta_tipos ("institutionId", codigo)
    `);
  }

  if (await tableExists(ds, 'curricula')) {
    await ds.query(`
      CREATE INDEX IF NOT EXISTS idx_curricula_ie_anio_nivel
      ON curricula ("institutionId", anio, nivel)
    `);
  }
}

async function dropUniqueIndexesOnColumns(
  ds: DataSource,
  table: string,
  columns: string[],
): Promise<void> {
  const rows: Array<{ indexname: string }> = await ds.query(
    `
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = $1
      AND indexdef ILIKE '%UNIQUE%'
      AND indexname NOT LIKE '%pkey%'
    `,
    [table],
  );

  for (const { indexname } of rows) {
    const defRows: Array<{ indexdef: string }> = await ds.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = $1`,
      [indexname],
    );
    const def = defRows[0]?.indexdef ?? '';
    const matchesAll = columns.every((col) =>
      def.includes(`"${col}"`) || def.includes(`(${col})`) || def.includes(` ${col} `),
    );
    if (matchesAll) {
      await ds.query(`DROP INDEX IF EXISTS "${indexname}"`);
    }
  }
}

async function dropUniqueConstraintsOnColumns(
  ds: DataSource,
  table: string,
  columns: string[],
): Promise<void> {
  for (const column of columns) {
    const rows: Array<{ conname: string }> = await ds.query(
      `
      SELECT con.conname
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_attribute att ON att.attrelid = con.conrelid
        AND att.attnum = ANY(con.conkey)
      WHERE rel.relname = $1
        AND con.contype = 'u'
        AND att.attname = $2
      `,
      [table, column],
    );
    for (const { conname } of rows) {
      await ds.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${conname}"`);
    }
  }
}
