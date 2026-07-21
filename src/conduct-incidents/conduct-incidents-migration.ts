import { DataSource } from 'typeorm';

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

async function columnExists(
  dataSource: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const [{ exists }] = await dataSource.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS exists`,
    [table, column],
  );
  return exists;
}

/** Prepara la tabla antes de que TypeORM sincronice columnas NOT NULL. */
export async function prepareConductIncidentsTable(
  dataSource: DataSource,
): Promise<void> {
  const table = 'conduct_incidents';
  if (!(await tableExists(dataSource, table))) return;

  if (!(await columnExists(dataSource, table, 'tipo'))) {
    await dataSource.query(`
      ALTER TABLE conduct_incidents
      ADD COLUMN tipo varchar(40) DEFAULT 'falta_leve'
    `);
  }

  await dataSource.query(`
    UPDATE conduct_incidents
    SET tipo = 'falta_leve'
    WHERE tipo IS NULL
  `);

  await dataSource.query(`
    ALTER TABLE conduct_incidents
    ALTER COLUMN tipo TYPE varchar(40)
  `);

  await dataSource.query(`
    ALTER TABLE conduct_incidents
    ALTER COLUMN tipo SET NOT NULL
  `);

  if (!(await columnExists(dataSource, table, 'descripcion'))) {
    await dataSource.query(`
      ALTER TABLE conduct_incidents
      ADD COLUMN descripcion text DEFAULT 'Sin descripción'
    `);
  }

  await dataSource.query(`
    UPDATE conduct_incidents
    SET descripcion = COALESCE(descripcion, 'Sin descripción')
    WHERE descripcion IS NULL
  `);

  if (!(await columnExists(dataSource, table, 'fecha'))) {
    await dataSource.query(`
      ALTER TABLE conduct_incidents
      ADD COLUMN fecha date DEFAULT CURRENT_DATE
    `);
  }

  await dataSource.query(`
    UPDATE conduct_incidents
    SET fecha = COALESCE(fecha, CURRENT_DATE)
    WHERE fecha IS NULL
  `);

  if (!(await columnExists(dataSource, table, 'estado'))) {
    await dataSource.query(`
      ALTER TABLE conduct_incidents
      ADD COLUMN estado varchar(15) DEFAULT 'pendiente'
    `);
  }

  await dataSource.query(`
    UPDATE conduct_incidents
    SET estado = COALESCE(estado, 'pendiente')
    WHERE estado IS NULL
  `);
}
