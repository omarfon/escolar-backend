const { Client } = require('pg');

async function main() {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'escolar',
  });
  await c.connect();

  const students = await c.query(
    `SELECT id, nombre, apellido, nivel, grado, seccion, activo, "estadoMatricula"
     FROM students
     WHERE activo = true AND "estadoMatricula" = 'activo'
       AND nivel = 'Primaria' AND grado = '5°' AND seccion = 'A'
     ORDER BY apellido, nombre`,
  );
  console.log('students 5A:', students.rowCount, students.rows);

  const att = await c.query(
    `SELECT COUNT(*)::int AS n FROM attendances WHERE fecha = '2026-06-15'`,
  );
  console.log('attendances 2026-06-15:', att.rows[0]);

  const feriado = await c.query(
    `SELECT * FROM maestros_feriados WHERE fecha = '2026-06-15' AND activo = true LIMIT 1`,
  );
  console.log('feriado:', feriado.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
