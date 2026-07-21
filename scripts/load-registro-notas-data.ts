/**

 * Carga notas demo por componente para el registro de evaluación.

 * Uso: npm run db:registro-notas-data

 */

import { readFileSync } from 'fs';

import { join } from 'path';

import { Client } from 'pg';



function env(key: string, fallback: string): string {

  return process.env[key]?.trim() || fallback;

}



async function main(): Promise<void> {

  const client = new Client({

    host: env('DB_HOST', 'localhost'),

    port: Number(env('DB_PORT', '5433')),

    user: env('DB_USER', 'postgres'),

    password: env('DB_PASSWORD', 'postgres'),

    database: env('DB_NAME', 'escolar'),

  });



  const sqlPath = join(__dirname, 'registro-notas-data.sql');

  const sql = readFileSync(sqlPath, 'utf8');



  await client.connect();

  try {

    await client.query(sql);

    const { rows } = await client.query<{

      total: string;

      con_componente: string;

      primaria_5a_mat_b2: string;

    }>(`

      SELECT

        (SELECT COUNT(*)::text FROM grades) AS total,

        (SELECT COUNT(*)::text FROM grades WHERE COALESCE("componenteCodigo", '') <> '') AS con_componente,

        (

          SELECT COUNT(*)::text FROM grades g

          JOIN students s ON s.id = g."studentId"

          WHERE s.nivel = 'Primaria' AND s.grado = '5°' AND upper(trim(s.seccion)) = 'A'

            AND g.curso = 'Matemática' AND g.bimestre = 2

        ) AS primaria_5a_mat_b2

    `);

    const counts = rows[0];

    console.log('Registro de notas — datos cargados:');

    console.log(`  grades (total):              ${counts.total} filas`);

    console.log(`  grades (con componente):   ${counts.con_componente} filas`);

    console.log(`  Primaria 5°A Mat B2:         ${counts.primaria_5a_mat_b2} filas`);

  } finally {

    await client.end();

  }

}



main().catch((err: Error) => {

  console.error('Error al cargar registro de notas:', err.message);

  process.exit(1);

});


