-- =============================================================================
-- Datos maestros de sedes vinculadas a la institución educativa
-- Fuente de verdad: PostgreSQL (tabla sedes)
--
-- Ejecutar: npm run db:sedes-data
-- Requisito: tabla institutions con al menos una fila (seed del backend)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sedes (
  id SERIAL PRIMARY KEY,
  "institutionId" INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(20) NOT NULL DEFAULT '',
  direccion VARCHAR(200) NOT NULL DEFAULT '',
  distrito VARCHAR(80) NOT NULL DEFAULT '',
  provincia VARCHAR(80) NOT NULL DEFAULT '',
  region VARCHAR(80) NOT NULL DEFAULT '',
  telefono VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(120) NOT NULL DEFAULT '',
  director VARCHAR(120) NOT NULL DEFAULT '',
  niveles JSONB NOT NULL DEFAULT '[]'::jsonb,
  turnos JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado VARCHAR(10) NOT NULL DEFAULT 'activo'
);

-- Institución demo (solo si no existe ninguna)
INSERT INTO institutions (
  nombre, siglas, ruc, "codigoModular", "tipoGestion", ugel, dre, resolucion,
  direccion, distrito, provincia, region, "codigoPostal", telefono, telefono2,
  email, web, facebook, director, subdirector, administrador, anio,
  "sistemaEval", "tipoPeriodo", "notaMinima", niveles, periodos, config, modulos
)
SELECT
  'I.E.P. San Martin de Porres',
  'IEP SMP',
  '20512345678',
  '0654321',
  'privada',
  'UGEL 01',
  'DRELM',
  'RD N 1234-2005',
  'Av. Los Heroes 123',
  'San Juan de Miraflores',
  'Lima',
  'Lima',
  '15800',
  '01-5551234',
  '',
  'info@sanmartin.edu.pe',
  'https://www.sanmartin.edu.pe',
  '',
  'Juan Carlos Perez Torres',
  'Maria Elena Quispe Huanca',
  'Carlos Mamani Flores',
  '2026',
  'numerico',
  'bimestre',
  11,
  '[]'::jsonb,
  '[
    {"numero":1,"nombre":"1 Bimestre","tipo":"bimestre","inicio":"2026-03-10","fin":"2026-05-09","actual":false},
    {"numero":2,"nombre":"2 Bimestre","tipo":"bimestre","inicio":"2026-05-12","fin":"2026-07-25","actual":true},
    {"numero":3,"nombre":"3 Bimestre","tipo":"bimestre","inicio":"2026-08-11","fin":"2026-10-17","actual":false},
    {"numero":4,"nombre":"4 Bimestre","tipo":"bimestre","inicio":"2026-10-20","fin":"2026-12-19","actual":false}
  ]'::jsonb,
  '{"moneda":"PEN","timezone":"America/Lima","formatoFecha":"DD/MM/YYYY"}'::jsonb,
  '[
    {"key":"matricula","label":"Matricula","desc":"Gestion de matriculas y vacantes","icon":"how_to_reg","activo":true},
    {"key":"asistencia","label":"Asistencia","desc":"Registro diario de asistencia","icon":"fact_check","activo":true},
    {"key":"evaluacion","label":"Evaluacion","desc":"Notas y calificaciones","icon":"grading","activo":true},
    {"key":"tesoreria","label":"Tesoreria","desc":"Pagos y control de deudas","icon":"payments","activo":true},
    {"key":"biblioteca","label":"Biblioteca","desc":"Prestamos y catalogo","icon":"menu_book","activo":false},
    {"key":"transporte","label":"Transporte","desc":"Rutas y asignacion de buses","icon":"directions_bus","activo":false},
    {"key":"horarios","label":"Horarios","desc":"Programacion de horarios","icon":"schedule","activo":true},
    {"key":"comunicados","label":"Comunicados","desc":"Mensajeria y notificaciones","icon":"campaign","activo":true}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM institutions);

WITH inst AS (
  SELECT id FROM institutions ORDER BY id ASC LIMIT 1
),
sedes_seed(
  nombre, codigo, direccion, distrito, provincia, region,
  telefono, email, director, niveles, turnos, estado
) AS (
  VALUES
    (
      'Sede Central',
      'SEDE-01',
      'Av. Los Heroes 123',
      'San Juan de Miraflores',
      'Lima',
      'Lima',
      '01-5551234',
      'central@sanmartin.edu.pe',
      'Juan Carlos Perez Torres',
      '["Primaria","Secundaria"]'::jsonb,
      '["Manana","Tarde"]'::jsonb,
      'activo'
    ),
    (
      'Sede Inicial',
      'SEDE-02',
      'Jr. Las Flores 456',
      'San Juan de Miraflores',
      'Lima',
      'Lima',
      '01-5554321',
      'inicial@sanmartin.edu.pe',
      'Rosa Gutierrez Lima',
      '["Inicial"]'::jsonb,
      '["Manana"]'::jsonb,
      'activo'
    )
)
INSERT INTO sedes (
  "institutionId", nombre, codigo, direccion, distrito, provincia, region,
  telefono, email, director, niveles, turnos, estado
)
SELECT
  inst.id,
  s.nombre,
  s.codigo,
  s.direccion,
  s.distrito,
  s.provincia,
  s.region,
  s.telefono,
  s.email,
  s.director,
  s.niveles,
  s.turnos,
  s.estado
FROM inst
CROSS JOIN sedes_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM sedes existing
  WHERE existing."institutionId" = inst.id
    AND existing.nombre = s.nombre
);

COMMIT;
