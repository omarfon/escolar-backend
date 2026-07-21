-- =============================================================================
-- Asistencia demo: faltas, tardanzas y justificaciones (jun–jul 2026)
-- Fuente de verdad: PostgreSQL (tabla attendances)
--
-- Ejecutar: npm run db:asistencia-data
-- Requisito: alumnos activos en students (backend iniciado al menos una vez)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS attendances (
  id SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  fecha DATE NOT NULL,
  estado VARCHAR(1) NOT NULL,
  observacion VARCHAR
);

-- Recargar meses visibles en Control de Faltas (sin tocar otros años)
DELETE FROM attendances
WHERE fecha >= '2026-06-01'::date
  AND fecha <= '2026-07-31'::date;

WITH dias_lectivos AS (
  SELECT d::date AS fecha
  FROM generate_series('2026-06-01'::date, '2026-07-17'::date, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
),
alumnos AS (
  SELECT id
  FROM students
  WHERE activo = true
    AND COALESCE("estadoMatricula", 'activo') = 'activo'
),
matriz AS (
  SELECT
    a.id AS "studentId",
    dl.fecha,
    ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY dl.fecha) AS rn,
    COUNT(*) OVER (PARTITION BY a.id) AS total_dias,
    (a.id % 10) AS perfil
  FROM alumnos a
  CROSS JOIN dias_lectivos dl
),
estados AS (
  SELECT
    m."studentId",
    m.fecha,
    CASE
      -- Perfil crítico: 6+ faltas injustificadas
      WHEN m.perfil = 1 AND m.rn IN (2, 4, 6, 9, 12, 15, 18) THEN 'F'
      WHEN m.perfil = 1 AND m.rn IN (11, 16) THEN 'T'
      WHEN m.perfil = 1 AND m.rn = 8 THEN 'J'

      -- Perfil alerta: 3–4 faltas
      WHEN m.perfil = 2 AND m.rn IN (3, 8, 13, 20) THEN 'F'
      WHEN m.perfil = 2 AND m.rn IN (5, 14) THEN 'T'

      -- Perfil tardanzas frecuentes
      WHEN m.perfil = 3 AND m.rn IN (2, 5, 8, 11, 14, 17, 20) THEN 'T'
      WHEN m.perfil = 3 AND m.rn IN (10, 19) THEN 'F'

      -- Perfil mixto con justificaciones
      WHEN m.perfil = 4 AND m.rn IN (4, 12, 21) THEN 'J'
      WHEN m.perfil = 4 AND m.rn IN (7, 16) THEN 'F'
      WHEN m.perfil = 4 AND m.rn IN (9) THEN 'T'

      -- Perfil casi perfecto
      WHEN m.perfil = 5 AND m.rn IN (15) THEN 'T'
      WHEN m.perfil = 5 AND m.rn IN (22) THEN 'F'

      -- Resto: variación ligera
      WHEN m.perfil IN (6, 7) AND m.rn % 11 = 0 THEN 'F'
      WHEN m.perfil IN (6, 7) AND m.rn % 7 = 0 THEN 'T'
      WHEN m.perfil IN (8, 9) AND m.rn % 13 = 0 THEN 'J'
      WHEN m.perfil IN (8, 9) AND m.rn % 9 = 0 THEN 'F'
      ELSE 'P'
    END AS estado
  FROM matriz m
)
INSERT INTO attendances ("studentId", fecha, estado, observacion)
SELECT
  e."studentId",
  e.fecha,
  e.estado,
  CASE e.estado
    WHEN 'F' THEN 'Inasistencia sin justificar'
    WHEN 'T' THEN 'Tardanza registrada'
    WHEN 'J' THEN 'Justificada — certificado médico'
    ELSE NULL
  END
FROM estados e;

COMMIT;
