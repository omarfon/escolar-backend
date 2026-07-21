-- =============================================================================

-- Datos demo: registro de notas por componente (componenteCodigo)

-- Fuente: fórmulas examen_parcial / examen_final / trabajo_exposicion

--

-- Ejecutar: npm run db:registro-notas-data

-- Requisito: alumnos demo (npm run start:dev al menos una vez)

-- =============================================================================



BEGIN;



ALTER TABLE grades ADD COLUMN IF NOT EXISTS "componenteCodigo" VARCHAR(40) DEFAULT '';



-- Migrar notas antiguas sin componenteCodigo

UPDATE grades

SET "componenteCodigo" = CASE tipo

  WHEN 'partial' THEN 'examen_parcial'

  WHEN 'final'   THEN 'examen_final'

  ELSE 'trabajo_exposicion'

END

WHERE COALESCE("componenteCodigo", '') = '';



-- Combos demo: Primaria 5° A/B, Secundaria 2° A/B — bimestre 2 (y Matemática B1 en 5°A)

WITH combos AS (

  SELECT * FROM (VALUES

    ('Primaria',   '5°', 'A', 'Matemática',           2),

    ('Primaria',   '5°', 'A', 'Comprensión Lectora',  2),

    ('Primaria',   '5°', 'A', 'Ciencia y Tecnología', 2),

    ('Primaria',   '5°', 'A', 'Inglés',               2),

    ('Primaria',   '5°', 'A', 'Matemática',           1),

    ('Primaria',   '5°', 'B', 'Matemática',           2),

    ('Primaria',   '5°', 'B', 'Comprensión Lectora',  2),

    ('Primaria',   '4°', 'A', 'Matemática',           2),

    ('Secundaria', '2°', 'A', 'Comunicación',         2),

    ('Secundaria', '2°', 'A', 'Aritmética',           2),

    ('Secundaria', '2°', 'A', 'CTA',                  2),

    ('Secundaria', '2°', 'B', 'Comunicación',         2)

  ) AS t(nivel, grado, seccion, curso, bimestre)

),

componentes AS (

  SELECT * FROM (VALUES

    ('examen_parcial',     'partial', '10'),

    ('examen_final',       'final',   '22'),

    ('trabajo_exposicion', 'daily',   '05')

  ) AS c(codigo, tipo, dia)

),

bimestre_mes AS (

  SELECT * FROM (VALUES (1, '04'), (2, '06'), (3, '09'), (4, '11')) AS b(bimestre, mes)

)

INSERT INTO grades ("studentId", curso, tipo, "componenteCodigo", bimestre, nota, "fechaEvaluacion", descripcion)

SELECT

  s.id,

  c.curso,

  comp.tipo,

  comp.codigo,

  c.bimestre,

  LEAST(

    20,

    10 + ((s.id * 13 + c.bimestre * 7 + length(comp.codigo) * 2 + length(c.curso) * 3) % 9)

  )::float,

  ('2026-' || bm.mes || '-' || comp.dia)::date,

  c.grado || ' ' || c.seccion || ' — ' || comp.codigo || ' B' || c.bimestre

FROM combos c

JOIN students s

  ON s.activo = true

 AND s."estadoMatricula" = 'activo'

 AND s.nivel = c.nivel

 AND s.grado = c.grado

 AND upper(trim(s.seccion)) = c.seccion

CROSS JOIN componentes comp

JOIN bimestre_mes bm ON bm.bimestre = c.bimestre

WHERE (s.id + length(comp.codigo)) % 7 <> 0

  AND NOT EXISTS (

    SELECT 1 FROM grades g

    WHERE g."studentId" = s.id

      AND g.curso = c.curso

      AND g.bimestre = c.bimestre

      AND g."componenteCodigo" = comp.codigo

  );



COMMIT;


