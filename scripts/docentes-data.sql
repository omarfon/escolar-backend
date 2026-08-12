-- =============================================================================
-- Datos maestros de docentes: usuarios de login + tabla docentes
-- Fuente de verdad: PostgreSQL (tabla docentes)
--
-- Ejecutar: npm run db:docentes-data
-- Requisito: backend iniciado al menos una vez (tabla docentes creada por TypeORM)
-- =============================================================================

BEGIN;

-- Columna direccion (perfil editable del portal docente)
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS direccion VARCHAR(200) NOT NULL DEFAULT '';

-- ─── 0. Tabla docentes (si TypeORM aún no la creó) ───────────────────────────

CREATE TABLE IF NOT EXISTS docentes (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER UNIQUE,
  nombres VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  dni VARCHAR(8) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  telefono VARCHAR(30) NOT NULL DEFAULT '',
  direccion VARCHAR(200) NOT NULL DEFAULT '',
  sede VARCHAR(80) NOT NULL DEFAULT 'Sede Central',
  estado VARCHAR(10) NOT NULL DEFAULT 'activo',
  especialidad VARCHAR(120) NOT NULL DEFAULT '',
  tipo VARCHAR(20) NOT NULL DEFAULT 'nombrado',
  "maxHoras" INTEGER NOT NULL DEFAULT 30,
  abrev VARCHAR(40) NOT NULL DEFAULT ''
);

-- ─── 1. Usuarios docente adicionales (login) ─────────────────────────────────

WITH docentes_extra(
  nombres, apellidos, dni, email, username, telefono, sede, estado, cargo, password
) AS (
  VALUES
    ('Patricia', 'Morales Vega',   '47123678', 'p.morales@escolar.pe',   'p.morales',   '987021021', 'Sede Central', 'activo', 'Docente de Tutoría',              'admin123'),
    ('Ricardo',  'Salas Ortiz',    '47234789', 'r.salas@escolar.pe',     'r.salas',     '987022022', 'Sede Central', 'activo', 'Docente de Matematicas',          'admin123'),
    ('Sofia',    'Benavides Loa',  '47345890', 's.benavides@escolar.pe', 's.benavides', '987023023', 'Sede Central', 'activo', 'Docente de Comunicacion',         'admin123'),
    ('Oscar',    'Nuñez Rios',     '47456901', 'o.nunez@escolar.pe',     'o.nunez',     '987024024', 'Sede Central', 'activo', 'Docente de Ciencias',             'admin123'),
    ('Daniela',  'Vela Castro',    '47567012', 'd.vela@escolar.pe',      'd.vela',      '987025025', 'Sede Central', 'activo', 'Docente de Historia',             'admin123'),
    ('Hugo',     'Terrazas Moya',  '47678123', 'h.terrazas@escolar.pe',  'h.terrazas',  '987026026', 'Sede Central', 'activo', 'Docente de Educacion Fisica',     'admin123'),
    ('Gabriela', 'Solis Paredes',  '47789234', 'g.solis@escolar.pe',     'g.solis',     '987027027', 'Sede Inicial', 'activo', 'Docente de Arte',                 'admin123'),
    ('Edwin',    'Cordova Lima',   '47890345', 'e.cordova@escolar.pe',   'e.cordova',   '987028028', 'Sede Central', 'activo', 'Docente de Ingles',               'admin123'),
    ('Rosa',     'Miranda Apaza',  '47901456', 'r.miranda@escolar.pe',   'r.miranda',   '987029029', 'Sede Central', 'activo', 'Docente de Musica contratado',    'admin123'),
    ('Javier',   'Rojas Quispe',   '48012567', 'j.rojas@escolar.pe',     'j.rojas',     '987030030', 'Sede Inicial', 'activo', 'Docente de Tecnologia',           'admin123'),
    ('Juan',     'Perez García',   '48123678', 'j.perez@escolar.pe',     'juan.perez',  '987031031', 'Sede Central', 'activo', 'Docente de Matematicas',          'admin123')
)
INSERT INTO users (nombres, apellidos, dni, email, username, telefono, rol, sede, estado, cargo, password, "ultimoAcceso")
SELECT
  d.nombres, d.apellidos, d.dni, d.email, d.username, d.telefono,
  'DOCENTE', d.sede, d.estado, d.cargo, d.password, NULL
FROM docentes_extra d
WHERE NOT EXISTS (
  SELECT 1 FROM users u
  WHERE u.email = d.email OR u.dni = d.dni OR u.username = d.username
);

-- ─── 2. Sincronizar tabla docentes desde users (rol DOCENTE) ─────────────────

INSERT INTO docentes (
  "userId", nombres, apellidos, dni, email, username, telefono,
  sede, estado, especialidad, tipo, "maxHoras", abrev
)
SELECT
  u.id,
  u.nombres,
  u.apellidos,
  u.dni,
  u.email,
  u.username,
  COALESCE(u.telefono, ''),
  COALESCE(u.sede, 'Sede Central'),
  COALESCE(u.estado, 'activo'),
  COALESCE(NULLIF(TRIM(u.cargo), ''), 'Docente'),
  CASE WHEN LOWER(COALESCE(u.cargo, '')) LIKE '%contrat%' THEN 'contratado' ELSE 'nombrado' END,
  CASE WHEN LOWER(COALESCE(u.cargo, '')) LIKE '%contrat%' THEN 24 ELSE 30 END,
  CONCAT(
    UPPER(SUBSTRING(TRIM(u.nombres) FROM 1 FOR 1)),
    '. ',
    SPLIT_PART(TRIM(u.apellidos), ' ', 1)
  )
FROM users u
WHERE u.rol = 'DOCENTE'
  AND NOT EXISTS (
    SELECT 1 FROM docentes d
    WHERE d."userId" = u.id OR d.email = u.email OR d.dni = u.dni
  );

UPDATE docentes d
SET
  "userId" = u.id,
  nombres = u.nombres,
  apellidos = u.apellidos,
  email = u.email,
  username = u.username,
  telefono = COALESCE(u.telefono, ''),
  sede = COALESCE(u.sede, 'Sede Central'),
  estado = COALESCE(u.estado, 'activo'),
  especialidad = COALESCE(NULLIF(TRIM(u.cargo), ''), 'Docente'),
  tipo = CASE WHEN LOWER(COALESCE(u.cargo, '')) LIKE '%contrat%' THEN 'contratado' ELSE 'nombrado' END,
  "maxHoras" = CASE WHEN LOWER(COALESCE(u.cargo, '')) LIKE '%contrat%' THEN 24 ELSE 30 END,
  abrev = CONCAT(
    UPPER(SUBSTRING(TRIM(u.nombres) FROM 1 FOR 1)),
    '. ',
    SPLIT_PART(TRIM(u.apellidos), ' ', 1)
  )
FROM users u
WHERE u.rol = 'DOCENTE'
  AND (d."userId" = u.id OR d.email = u.email OR d.dni = u.dni);

-- ─── 3. Remapear FKs legacy (userId → docentes.id) ───────────────────────────

UPDATE curricula_teacher_assignments cta
SET "docenteId" = d.id
FROM docentes d
WHERE cta."docenteId" IS NOT NULL
  AND cta."docenteId" = d."userId"
  AND NOT EXISTS (SELECT 1 FROM docentes d2 WHERE d2.id = cta."docenteId");

UPDATE horario_blocks hb
SET "docenteId" = d.id
FROM docentes d
WHERE hb."docenteId" IS NOT NULL
  AND hb."docenteId" = d."userId"
  AND NOT EXISTS (SELECT 1 FROM docentes d2 WHERE d2.id = hb."docenteId");

-- ─── 4. Salones demo para login docente (portal asistencia) ───────────────────
-- Una sola asignación Matemática 5° con secciones A y B; desactiva duplicados previos.

UPDATE curricula_teacher_assignments cta
SET secciones = '["A","B"]'::jsonb,
    grado = '5°',
    activo = true
FROM docentes d
INNER JOIN curricula_subjects cs ON cs.id = cta."cursoId"
WHERE cta."docenteId" = d.id
  AND d.username = 'docente'
  AND cs.nombre ILIKE 'Matem%'
  AND cta.nivel = 'Primaria'
  AND cta.grado IN ('5°', '5 Grado', '5')
  AND cta.id = (
    SELECT MIN(cta2.id)
    FROM curricula_teacher_assignments cta2
    INNER JOIN curricula_subjects cs2 ON cs2.id = cta2."cursoId"
    WHERE cta2."docenteId" = d.id
      AND cs2.nombre ILIKE 'Matem%'
      AND cta2.nivel = 'Primaria'
      AND cta2.grado IN ('5°', '5 Grado', '5')
  );

UPDATE curricula_teacher_assignments dup
SET activo = false
FROM docentes d
INNER JOIN curricula_subjects cs ON cs.id = dup."cursoId"
WHERE dup."docenteId" = d.id
  AND d.username = 'docente'
  AND cs.nombre ILIKE 'Matem%'
  AND dup.nivel = 'Primaria'
  AND dup.grado IN ('5°', '5 Grado', '5')
  AND dup.activo = true
  AND dup.id NOT IN (
    SELECT MIN(cta.id)
    FROM curricula_teacher_assignments cta
    INNER JOIN docentes d2 ON d2.id = cta."docenteId"
    INNER JOIN curricula_subjects cs2 ON cs2.id = cta."cursoId"
    WHERE d2.username = 'docente'
      AND cs2.nombre ILIKE 'Matem%'
      AND cta.nivel = 'Primaria'
      AND cta.grado IN ('5°', '5 Grado', '5')
  );

COMMIT;
