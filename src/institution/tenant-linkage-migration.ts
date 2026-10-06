import { DataSource } from 'typeorm';

const POR_ALUMNO: Array<[string, string]> = [
  ['grades', 'studentId'],
  ['attendances', 'studentId'],
  ['promedios', 'studentId'],
  ['competency_evaluations', 'studentId'],
  ['report_cards', 'studentId'],
  ['student_charges', 'studentId'],
  ['enrollment_evaluations', 'studentId'],
  ['conduct_incidents', 'studentId'],
];

const DE_LA_IE = ['announcements', 'eventos', 'payment_concepts', 'student_payments'];

export async function prepareTenantLinkage(ds: DataSource): Promise<void> {
  for (const [table, studentColumn] of POR_ALUMNO) {
    await vincularPorAlumno(ds, table, studentColumn);
  }
  for (const table of DE_LA_IE) {
    await agregarInstitucion(ds, table);
  }

  await ds.query(`
    UPDATE student_payments p
    SET "institutionId" = c."institutionId"
    FROM student_charges c
    WHERE p."chargeId" = c.id
      AND p."institutionId" IS NULL
      AND c."institutionId" IS NOT NULL
  `);

  await ds.query(`
    UPDATE announcements SET "institutionId" = sub.id
    FROM (SELECT id FROM institutions ORDER BY id ASC LIMIT 1) sub
    WHERE announcements."institutionId" IS NULL
  `);
  await ds.query(`
    UPDATE eventos SET "institutionId" = sub.id
    FROM (SELECT id FROM institutions ORDER BY id ASC LIMIT 1) sub
    WHERE eventos."institutionId" IS NULL
  `);
  await ds.query(`
    UPDATE payment_concepts SET "institutionId" = sub.id
    FROM (SELECT id FROM institutions ORDER BY id ASC LIMIT 1) sub
    WHERE payment_concepts."institutionId" IS NULL
  `);
}

async function tablaExiste(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(`SELECT to_regclass($1) AS nombre`, [`public.${table}`]);
  return Boolean(rows[0]?.nombre);
}

async function agregarInstitucion(ds: DataSource, table: string): Promise<void> {
  if (!(await tablaExiste(ds, table))) return;
  await ds.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "institutionId" integer NULL`,
  );
  await ds.query(
    `CREATE INDEX IF NOT EXISTS idx_${table}_institution ON ${table} ("institutionId")`,
  );
}

async function vincularPorAlumno(
  ds: DataSource,
  table: string,
  studentColumn: string,
): Promise<void> {
  await agregarInstitucion(ds, table);
  if (!(await tablaExiste(ds, table))) return;
  await ds.query(`
    UPDATE ${table} t
    SET "institutionId" = s."institutionId"
    FROM students s
    WHERE t."${studentColumn}" = s.id
      AND t."institutionId" IS NULL
      AND s."institutionId" IS NOT NULL
  `);
}
