const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'escolar',
  });
  await c.connect();

  const tables = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%curricul%' ORDER BY 1",
  );
  console.log('tables:', tables.rows.map((r) => r.tablename));

  const tableList = [
    'curricula',
    'curricula_areas',
    'curricula_subjects',
    'curricula_competencias',
    'curricula_capacidades',
    'curricula_indicadores',
    'curricula_teacher_assignments',
  ];

  for (const table of tableList) {
    const s = await c.query(
      `SELECT pg_get_serial_sequence($1, 'id') AS seq, (SELECT MAX(id) FROM "${table}") AS max_id`,
      [table],
    );
    const row = s.rows[0];
    let last = null;
    if (row.seq) {
      const name = row.seq.includes('.') ? row.seq.split('.').pop() : row.seq;
      const lv = await c.query(`SELECT last_value, is_called FROM "${name}"`);
      last = lv.rows[0];
    }
    console.log(table, { seq: row.seq, max_id: row.max_id, last });
  }

  for (const name of [
    'curricula_capacidades_id_seq',
    'curriculum_capacidades_id_seq',
  ]) {
    const lv = await c.query(`SELECT last_value, is_called FROM "${name}"`);
    console.log('orphan seq?', name, lv.rows[0]);
  }

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
