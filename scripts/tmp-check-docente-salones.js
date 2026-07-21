const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'escolar',
  });
  await c.connect();
  const d = await c.query(
    "SELECT id, username FROM docentes WHERE username = 'docente'",
  );
  console.log('docente', d.rows);
  if (d.rows[0]) {
    const a = await c.query(
      `SELECT id, "cursoId", nivel, grado, secciones
       FROM curricula_teacher_assignments
       WHERE "docenteId" = $1 AND activo = true
       ORDER BY id`,
      [d.rows[0].id],
    );
    console.log('assignments', JSON.stringify(a.rows, null, 2));
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
