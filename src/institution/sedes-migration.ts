import { DataSource } from 'typeorm';

async function tableExists(ds: DataSource, name: string): Promise<boolean> {
  const [{ exists }] = await ds.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [name],
  );
  return exists;
}

async function sequenceExists(ds: DataSource, name: string): Promise<boolean> {
  const [{ exists }] = await ds.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = $1
    ) AS exists`,
    [name],
  );
  return exists;
}

/** Renombra tabla legacy campuses → sedes preservando datos y secuencia. */
export async function prepareSedesTable(ds: DataSource): Promise<void> {
  const campusesExists = await tableExists(ds, 'campuses');
  const sedesExists = await tableExists(ds, 'sedes');

  if (campusesExists && !sedesExists) {
    await ds.query(`ALTER TABLE "campuses" RENAME TO "sedes"`);

    const seqFrom = 'campuses_id_seq';
    const seqTo = 'sedes_id_seq';
    if (await sequenceExists(ds, seqFrom)) {
      if (await sequenceExists(ds, seqTo)) {
        await ds.query(`DROP SEQUENCE IF EXISTS "${seqTo}"`);
      }
      await ds.query(`ALTER SEQUENCE "${seqFrom}" RENAME TO "${seqTo}"`);
      await ds.query(
        `ALTER TABLE "sedes" ALTER COLUMN id SET DEFAULT nextval('${seqTo}'::regclass)`,
      );
    }
  }

  if (!(await tableExists(ds, 'sedes'))) {
    await ds.query(`
      CREATE TABLE sedes (
        id SERIAL PRIMARY KEY,
        "institutionId" INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
        nombre VARCHAR(120) NOT NULL,
        codigo VARCHAR(20) NOT NULL DEFAULT '',
        direccion VARCHAR(200) NOT NULL DEFAULT '',
        distrito VARCHAR(80) NOT NULL DEFAULT '',
        provincia VARCHAR(80) NOT NULL DEFAULT '',
        region VARCHAR(80) NOT NULL DEFAULT '',
        telefono VARCHAR(30) NOT NULL DEFAULT '',
        email VARCHAR(120) NOT NULL DEFAULT '',
        director VARCHAR(120) NOT NULL DEFAULT '',
        niveles JSONB NOT NULL DEFAULT '[]'::jsonb,
        turnos JSONB NOT NULL DEFAULT '[]'::jsonb,
        estado VARCHAR(10) NOT NULL DEFAULT 'activo'
      )
    `);
  }

  await ds.query(`
    UPDATE sedes
    SET "institutionId" = (SELECT id FROM institutions ORDER BY id ASC LIMIT 1)
    WHERE "institutionId" IS NULL
      AND EXISTS (SELECT 1 FROM institutions)
  `);
}
