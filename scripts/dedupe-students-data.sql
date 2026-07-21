-- =============================================================================
-- Elimina alumnos duplicados (mismo nombre en la misma aula)
-- Conserva el registro más completo (email real, código, menor id)
--
-- Ejecutar: npm run db:dedupe-students
-- =============================================================================

BEGIN;

CREATE TEMP TABLE student_dedupe_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    s.id,
    FIRST_VALUE(s.id) OVER (
      PARTITION BY
        s.nivel,
        s.grado,
        upper(trim(s.seccion)),
        lower(trim(s.nombre)),
        lower(trim(s.apellido))
      ORDER BY
        CASE
          WHEN s.email IS NOT NULL
            AND s.email <> ''
            AND s.email NOT ILIKE 'alumno.%@estudiante.pe'
          THEN 0
          ELSE 1
        END,
        CASE WHEN COALESCE(s.codigo, '') <> '' THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(s.dni, '') <> '' THEN 0 ELSE 1 END,
        s.id
    ) AS keep_id
  FROM students s
  WHERE s.activo = true
    AND COALESCE(s."estadoMatricula", 'activo') = 'activo'
)
SELECT id AS remove_id, keep_id
FROM ranked
WHERE id <> keep_id;

-- Reasignar referencias al alumno conservado
UPDATE grades g
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE g."studentId" = m.remove_id;

UPDATE attendances a
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE a."studentId" = m.remove_id;

UPDATE student_academic_history h
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE h."studentId" = m.remove_id;

UPDATE student_documents d
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE d."studentId" = m.remove_id;

UPDATE conduct_incidents c
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE c."studentId" = m.remove_id;

UPDATE tasks t
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE t."studentId" = m.remove_id;

UPDATE schedules s
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE s."studentId" = m.remove_id;

UPDATE parent_students p
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE p."studentId" = m.remove_id;

UPDATE attendance_justifications j
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE j."studentId" = m.remove_id;

UPDATE competency_evaluations ce
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE ce."studentId" = m.remove_id;

UPDATE section_changes sc
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE sc."studentId" = m.remove_id;

UPDATE continuity_enrollments ce
SET "studentId" = m.keep_id
FROM student_dedupe_map m
WHERE ce."studentId" = m.remove_id;

-- Quitar filas duplicadas generadas al fusionar
DELETE FROM grades g1
USING grades g2
WHERE g1.id > g2.id
  AND g1."studentId" = g2."studentId"
  AND g1.curso = g2.curso
  AND g1.bimestre = g2.bimestre
  AND COALESCE(g1."componenteCodigo", '') = COALESCE(g2."componenteCodigo", '')
  AND g1.tipo = g2.tipo;

DELETE FROM attendances a1
USING attendances a2
WHERE a1.id > a2.id
  AND a1."studentId" = a2."studentId"
  AND a1.fecha = a2.fecha;

DELETE FROM student_academic_history h1
USING student_academic_history h2
WHERE h1.id > h2.id
  AND h1."studentId" = h2."studentId"
  AND h1.anio = h2.anio;

DELETE FROM student_documents d1
USING student_documents d2
WHERE d1.id > d2.id
  AND d1."studentId" = d2."studentId"
  AND d1.tipo = d2.tipo;

DELETE FROM parent_students p1
USING parent_students p2
WHERE p1.id > p2.id
  AND p1."studentId" = p2."studentId"
  AND p1."parentEmail" = p2."parentEmail";

-- Eliminar alumnos duplicados
DELETE FROM students s
USING student_dedupe_map m
WHERE s.id = m.remove_id;

COMMIT;
