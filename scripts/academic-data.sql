-- =============================================================================
-- Datos académicos demo: historial, notas y asistencia
-- Fuente de verdad: PostgreSQL (tablas student_academic_history, grades, attendances)
--
-- Ejecutar: npm run db:academic-data
-- Requisito: alumnos demo ya creados (npm run start:dev al menos una vez)
-- =============================================================================

BEGIN;

-- ─── 0. Tablas académicas (si TypeORM aún no las creó) ───────────────────────

CREATE TABLE IF NOT EXISTS student_academic_history (
  id SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  anio VARCHAR(4) NOT NULL,
  grado VARCHAR(40) NOT NULL,
  seccion VARCHAR(5) NOT NULL,
  promedio DOUBLE PRECISION NOT NULL DEFAULT 0,
  estado VARCHAR(30) NOT NULL DEFAULT 'Promovido'
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "courseId" INTEGER,
  curso VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  bimestre INTEGER NOT NULL,
  nota DOUBLE PRECISION NOT NULL,
  "fechaEvaluacion" DATE NOT NULL,
  descripcion VARCHAR
);

CREATE TABLE IF NOT EXISTS attendances (
  id SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  fecha DATE NOT NULL,
  estado VARCHAR(1) NOT NULL,
  observacion VARCHAR
);

-- ─── 1. Historial académico (un grado por año escolar) ───────────────────────

WITH historial_demo(email, anio, grado, seccion, promedio, estado) AS (
  VALUES
    -- Juan Pérez — 5° Primaria A en 2026
    ('estudiante@escolar.pe',   '2021', '5 años',       'A', 14.0, 'Promovido'),
    ('estudiante@escolar.pe',   '2022', '1° Primaria',  'A', 14.2, 'Promovido'),
    ('estudiante@escolar.pe',   '2023', '2° Primaria',  'A', 14.5, 'Promovido'),
    ('estudiante@escolar.pe',   '2024', '3° Primaria',  'A', 14.8, 'Promovido'),
    ('estudiante@escolar.pe',   '2025', '4° Primaria',  'A', 15.2, 'Promovido'),

    ('l.torres@estudiante.pe',  '2021', '5 años',       'A', 13.8, 'Promovido'),
    ('l.torres@estudiante.pe',  '2022', '1° Primaria',  'A', 14.0, 'Promovido'),
    ('l.torres@estudiante.pe',  '2023', '2° Primaria',  'A', 14.3, 'Promovido'),
    ('l.torres@estudiante.pe',  '2024', '3° Primaria',  'A', 14.6, 'Promovido'),
    ('l.torres@estudiante.pe',  '2025', '4° Primaria',  'A', 15.0, 'Promovido'),

    ('c.mendoza@estudiante.pe', '2021', '5 años',       'A', 14.5, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2022', '1° Primaria',  'A', 14.8, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2023', '2° Primaria',  'A', 15.0, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2024', '3° Primaria',  'A', 15.5, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2025', '4° Primaria',  'A', 16.1, 'Promovido'),

    ('a.garcia@estudiante.pe',  '2021', '5 años',       'B', 13.9, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2022', '1° Primaria',  'B', 14.1, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2023', '2° Primaria',  'B', 14.4, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2024', '3° Primaria',  'B', 14.9, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2025', '4° Primaria',  'B', 15.5, 'Promovido'),

    ('j.paredes@estudiante.pe', '2021', '5 años',       'B', 13.5, 'Promovido'),
    ('j.paredes@estudiante.pe', '2022', '1° Primaria',  'B', 13.8, 'Promovido'),
    ('j.paredes@estudiante.pe', '2023', '2° Primaria',  'B', 14.0, 'Promovido'),
    ('j.paredes@estudiante.pe', '2024', '3° Primaria',  'B', 13.2, 'Repitente'),
    ('j.paredes@estudiante.pe', '2025', '4° Primaria',  'B', 14.8, 'Promovido'),

    ('m.quispe@estudiante.pe',  '2022', '5 años',       'A', 13.6, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2023', '1° Primaria',  'A', 13.9, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2024', '2° Primaria',  'A', 14.3, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2025', '3° Primaria',  'A', 15.0, 'Promovido'),

    ('l.castillo@estudiante.pe','2022', '5 años',       'A', 13.4, 'Promovido'),
    ('l.castillo@estudiante.pe','2023', '1° Primaria',  'A', 13.7, 'Promovido'),
    ('l.castillo@estudiante.pe','2024', '2° Primaria',  'A', 14.1, 'Promovido'),
    ('l.castillo@estudiante.pe','2025', '3° Primaria',  'A', 14.8, 'Promovido'),

    ('s.ramos@estudiante.pe',   '2021', '3° Primaria',  'A', 13.2, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2022', '4° Primaria',  'A', 13.8, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2023', '5° Primaria',  'A', 14.2, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2024', '6° Primaria',  'A', 14.7, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2025', '1° Secundaria', 'A', 14.9, 'Promovido'),

    ('d.fernandez@estudiante.pe','2021','3° Primaria',  'B', 13.0, 'Promovido'),
    ('d.fernandez@estudiante.pe','2022','4° Primaria',  'B', 13.5, 'Promovido'),
    ('d.fernandez@estudiante.pe','2023','5° Primaria',  'B', 14.0, 'Promovido'),
    ('d.fernandez@estudiante.pe','2024','6° Primaria',  'B', 14.4, 'Promovido'),
    ('d.fernandez@estudiante.pe','2025','1° Secundaria','B', 14.6, 'Promovido')
)
INSERT INTO student_academic_history ("studentId", anio, grado, seccion, promedio, estado)
SELECT s.id, h.anio, h.grado, h.seccion, h.promedio, h.estado
FROM historial_demo h
JOIN students s ON s.email = h.email
WHERE NOT EXISTS (
  SELECT 1 FROM student_academic_history x
  WHERE x."studentId" = s.id AND x.anio = h.anio
);

-- Corregir filas existentes con grado/estado incorrecto
WITH historial_demo(email, anio, grado, seccion, promedio, estado) AS (
  VALUES
    ('estudiante@escolar.pe',   '2021', '5 años',       'A', 14.0, 'Promovido'),
    ('estudiante@escolar.pe',   '2022', '1° Primaria',  'A', 14.2, 'Promovido'),
    ('estudiante@escolar.pe',   '2023', '2° Primaria',  'A', 14.5, 'Promovido'),
    ('estudiante@escolar.pe',   '2024', '3° Primaria',  'A', 14.8, 'Promovido'),
    ('estudiante@escolar.pe',   '2025', '4° Primaria',  'A', 15.2, 'Promovido'),
    ('l.torres@estudiante.pe',  '2021', '5 años',       'A', 13.8, 'Promovido'),
    ('l.torres@estudiante.pe',  '2022', '1° Primaria',  'A', 14.0, 'Promovido'),
    ('l.torres@estudiante.pe',  '2023', '2° Primaria',  'A', 14.3, 'Promovido'),
    ('l.torres@estudiante.pe',  '2024', '3° Primaria',  'A', 14.6, 'Promovido'),
    ('l.torres@estudiante.pe',  '2025', '4° Primaria',  'A', 15.0, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2021', '5 años',       'A', 14.5, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2022', '1° Primaria',  'A', 14.8, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2023', '2° Primaria',  'A', 15.0, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2024', '3° Primaria',  'A', 15.5, 'Promovido'),
    ('c.mendoza@estudiante.pe', '2025', '4° Primaria',  'A', 16.1, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2021', '5 años',       'B', 13.9, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2022', '1° Primaria',  'B', 14.1, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2023', '2° Primaria',  'B', 14.4, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2024', '3° Primaria',  'B', 14.9, 'Promovido'),
    ('a.garcia@estudiante.pe',  '2025', '4° Primaria',  'B', 15.5, 'Promovido'),
    ('j.paredes@estudiante.pe', '2021', '5 años',       'B', 13.5, 'Promovido'),
    ('j.paredes@estudiante.pe', '2022', '1° Primaria',  'B', 13.8, 'Promovido'),
    ('j.paredes@estudiante.pe', '2023', '2° Primaria',  'B', 14.0, 'Promovido'),
    ('j.paredes@estudiante.pe', '2024', '3° Primaria',  'B', 13.2, 'Repitente'),
    ('j.paredes@estudiante.pe', '2025', '4° Primaria',  'B', 14.8, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2022', '5 años',       'A', 13.6, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2023', '1° Primaria',  'A', 13.9, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2024', '2° Primaria',  'A', 14.3, 'Promovido'),
    ('m.quispe@estudiante.pe',  '2025', '3° Primaria',  'A', 15.0, 'Promovido'),
    ('l.castillo@estudiante.pe','2022', '5 años',       'A', 13.4, 'Promovido'),
    ('l.castillo@estudiante.pe','2023', '1° Primaria',  'A', 13.7, 'Promovido'),
    ('l.castillo@estudiante.pe','2024', '2° Primaria',  'A', 14.1, 'Promovido'),
    ('l.castillo@estudiante.pe','2025', '3° Primaria',  'A', 14.8, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2021', '3° Primaria',  'A', 13.2, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2022', '4° Primaria',  'A', 13.8, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2023', '5° Primaria',  'A', 14.2, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2024', '6° Primaria',  'A', 14.7, 'Promovido'),
    ('s.ramos@estudiante.pe',   '2025', '1° Secundaria', 'A', 14.9, 'Promovido'),
    ('d.fernandez@estudiante.pe','2021','3° Primaria',  'B', 13.0, 'Promovido'),
    ('d.fernandez@estudiante.pe','2022','4° Primaria',  'B', 13.5, 'Promovido'),
    ('d.fernandez@estudiante.pe','2023','5° Primaria',  'B', 14.0, 'Promovido'),
    ('d.fernandez@estudiante.pe','2024','6° Primaria',  'B', 14.4, 'Promovido'),
    ('d.fernandez@estudiante.pe','2025','1° Secundaria','B', 14.6, 'Promovido')
)
UPDATE student_academic_history x
SET grado = h.grado,
    seccion = h.seccion,
    promedio = h.promedio,
    estado = h.estado
FROM historial_demo h
JOIN students s ON s.email = h.email
WHERE x."studentId" = s.id
  AND x.anio = h.anio
  AND (x.grado <> h.grado OR x.estado <> h.estado OR x.seccion <> h.seccion);

-- Año escolar actual (2026): fila en historial por alumno activo
INSERT INTO student_academic_history ("studentId", anio, grado, seccion, promedio, estado)
SELECT
  s.id,
  '2026',
  CASE
    WHEN s.nivel = 'Inicial' THEN s.grado
    WHEN s.nivel = 'Primaria' THEN s.grado || ' Primaria'
    WHEN s.nivel = 'Secundaria' THEN s.grado || ' Secundaria'
    ELSE s.grado || ' ' || s.nivel
  END,
  s.seccion,
  COALESCE((
    SELECT ROUND(AVG(g.nota)::numeric, 1)
    FROM grades g
    WHERE g."studentId" = s.id
      AND g."fechaEvaluacion"::text LIKE '2026-%'
  ), 0),
  CASE
    WHEN s."estadoMatricula" = 'activo' THEN 'En curso'
    ELSE COALESCE(NULLIF(s."estadoMatricula", ''), 'Inactivo')
  END
FROM students s
WHERE s.activo = true
  AND NOT EXISTS (
    SELECT 1 FROM student_academic_history x
    WHERE x."studentId" = s.id AND x.anio = '2026'
  );

UPDATE student_academic_history x
SET
  grado = CASE
    WHEN s.nivel = 'Inicial' THEN s.grado
    WHEN s.nivel = 'Primaria' THEN s.grado || ' Primaria'
    WHEN s.nivel = 'Secundaria' THEN s.grado || ' Secundaria'
    ELSE s.grado || ' ' || s.nivel
  END,
  seccion = s.seccion,
  estado = CASE
    WHEN s."estadoMatricula" = 'activo' THEN 'En curso'
    ELSE COALESCE(NULLIF(s."estadoMatricula", ''), x.estado)
  END
FROM students s
WHERE x."studentId" = s.id
  AND x.anio = '2026'
  AND s.activo = true;

-- ─── 2. Notas (grades) por año escolar ───────────────────────────────────────

WITH cursos(curso) AS (
  VALUES
    ('Matemática'),
    ('Comprensión Lectora'),
    ('Ciencia y Tecnología'),
    ('Comunicación')
),
bimestres(bimestre, mes) AS (
  VALUES (1, '04'), (2, '06'), (3, '09'), (4, '11')
),
tipos(tipo, dia, nota_extra, label) AS (
  VALUES
    ('daily',   '05', 0, 'Control diario'),
    ('partial', '15', 1, 'Examen parcial'),
    ('final',   '28', 2, 'Final bimestral')
),
anios_historial AS (
  SELECT h."studentId", h.anio, h.grado
  FROM student_academic_history h
  UNION ALL
  SELECT s.id, '2026', s.grado || ' ' || s.nivel
  FROM students s
  WHERE s.activo = true
)
INSERT INTO grades ("studentId", curso, tipo, bimestre, nota, "fechaEvaluacion", descripcion)
SELECT
  ah."studentId",
  c.curso,
  t.tipo,
  b.bimestre,
  LEAST(20, 10 + ((ah."studentId" * 7 + length(c.curso) * 3 + b.bimestre * 5 + ah.anio::int) % 9) + t.nota_extra),
  (ah.anio || '-' || b.mes || '-' || t.dia)::date,
  ah.grado || ' — ' || t.label || ' A.E. ' || ah.anio
FROM anios_historial ah
CROSS JOIN cursos c
CROSS JOIN bimestres b
CROSS JOIN tipos t
WHERE ah.grado NOT LIKE '%Secundaria%'
  AND NOT EXISTS (
    SELECT 1 FROM grades g
    WHERE g."studentId" = ah."studentId"
      AND g."fechaEvaluacion"::text LIKE ah.anio || '-%'
      AND g.curso = c.curso
      AND g.bimestre = b.bimestre
      AND g.tipo = t.tipo
  );

-- Notas Secundaria (cursos distintos)
WITH cursos_sec(curso) AS (
  VALUES
    ('Matemática'),
    ('Comunicación'),
    ('Ciencia y Tecnología'),
    ('Historia del Perú'),
    ('Inglés')
),
bimestres(bimestre, mes) AS (
  VALUES (1, '04'), (2, '06'), (3, '09'), (4, '11')
),
tipos(tipo, dia, nota_extra, label) AS (
  VALUES
    ('daily',   '05', 0, 'Control diario'),
    ('partial', '15', 1, 'Examen parcial'),
    ('final',   '28', 2, 'Final bimestral')
),
anios_sec AS (
  SELECT h."studentId", h.anio, h.grado
  FROM student_academic_history h
  WHERE h.grado LIKE '%Secundaria%'
  UNION ALL
  SELECT s.id, '2026', s.grado || ' Secundaria'
  FROM students s
  WHERE s.activo = true AND s.nivel = 'Secundaria'
)
INSERT INTO grades ("studentId", curso, tipo, bimestre, nota, "fechaEvaluacion", descripcion)
SELECT
  ah."studentId",
  c.curso,
  t.tipo,
  b.bimestre,
  LEAST(20, 10 + ((ah."studentId" * 7 + length(c.curso) * 3 + b.bimestre * 5 + ah.anio::int) % 9) + t.nota_extra),
  (ah.anio || '-' || b.mes || '-' || t.dia)::date,
  ah.grado || ' — ' || t.label || ' A.E. ' || ah.anio
FROM anios_sec ah
CROSS JOIN cursos_sec c
CROSS JOIN bimestres b
CROSS JOIN tipos t
WHERE NOT EXISTS (
  SELECT 1 FROM grades g
  WHERE g."studentId" = ah."studentId"
    AND g."fechaEvaluacion"::text LIKE ah.anio || '-%'
    AND g.curso = c.curso
    AND g.bimestre = b.bimestre
    AND g.tipo = t.tipo
);

-- ─── 3. Asistencia (attendances) por año escolar ─────────────────────────────

WITH anios(anio) AS (
  VALUES ('2021'), ('2022'), ('2023'), ('2024'), ('2025'), ('2026')
),
fechas(fecha_suffix) AS (
  VALUES
    ('-03-03'), ('-03-05'), ('-03-08'),
    ('-04-03'), ('-04-05'), ('-04-08'),
    ('-05-03'), ('-05-05'), ('-05-08'),
    ('-06-03'), ('-06-05'), ('-06-10'),
    ('-08-03'), ('-08-05'), ('-08-08'),
    ('-09-03'), ('-09-05'), ('-09-08'),
    ('-10-03'), ('-10-05'), ('-10-08'),
    ('-11-03'), ('-11-05'), ('-11-08')
)
INSERT INTO attendances ("studentId", fecha, estado, observacion)
SELECT
  q."studentId",
  q.fecha,
  CASE
    WHEN q.rn % 9 = 0 THEN 'F'
    WHEN q.rn % 7 = 0 THEN 'T'
    WHEN q.rn % 13 = 0 THEN 'J'
    ELSE 'P'
  END,
  CASE
    WHEN q.rn % 9 = 0 THEN 'Inasistencia — A.E. ' || q.anio
    WHEN q.rn % 13 = 0 THEN 'Justificada'
    ELSE NULL
  END
FROM (
  SELECT
    s.id AS "studentId",
    a.anio,
    (a.anio || f.fecha_suffix)::date AS fecha,
    (s.id + row_number() OVER (ORDER BY s.id, a.anio, f.fecha_suffix))::int AS rn
  FROM students s
  CROSS JOIN anios a
  CROSS JOIN fechas f
  WHERE s.activo = true
) q
WHERE NOT EXISTS (
  SELECT 1 FROM attendances att
  WHERE att."studentId" = q."studentId"
    AND att.fecha = q.fecha
);

COMMIT;
