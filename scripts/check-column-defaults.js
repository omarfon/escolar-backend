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

  const cols = await c.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name LIKE 'curricula%'
      AND column_name = 'id'
    ORDER BY table_name
  `);
  console.log(cols.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
