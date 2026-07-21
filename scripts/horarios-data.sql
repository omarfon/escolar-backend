-- =============================================================================
-- Períodos horario (estructura semanal) — A.E. 2026
-- Fuente de verdad: PostgreSQL (tabla horario_periodos)
--
-- Ejecutar vía: npm run db:horarios-data
-- =============================================================================

CREATE TABLE IF NOT EXISTS horario_periodos (
  id SERIAL PRIMARY KEY,
  "anioEscolar" INTEGER NOT NULL,
  orden INTEGER NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  "horaInicio" VARCHAR(5) NOT NULL,
  "horaFin" VARCHAR(5) NOT NULL,
  "esReceso" BOOLEAN NOT NULL DEFAULT false,
  niveles JSONB NOT NULL DEFAULT '[]',
  activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO horario_periodos ("anioEscolar", orden, nombre, "horaInicio", "horaFin", "esReceso", niveles, activo)
SELECT v.anio, v.orden, v.nombre, v.inicio, v.fin, v.receso, v.niveles::jsonb, true
FROM (VALUES
  (2026, 1,  '1ª Hora', '07:45', '08:30', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 2,  '2ª Hora', '08:30', '09:15', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 3,  '3ª Hora', '09:15', '10:00', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 4,  'Recreo',  '10:00', '10:30', true,  '["Inicial","Primaria","Secundaria"]'),
  (2026, 5,  '4ª Hora', '10:30', '11:15', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 6,  '5ª Hora', '11:15', '12:00', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 7,  '6ª Hora', '12:00', '12:45', false, '["Inicial","Primaria","Secundaria"]'),
  (2026, 8,  '7ª Hora', '12:45', '13:30', false, '["Primaria","Secundaria"]'),
  (2026, 9,  '8ª Hora', '13:30', '14:15', false, '["Primaria","Secundaria"]'),
  (2026, 10, '9ª Hora', '14:15', '15:00', false, '["Secundaria"]')
) AS v(anio, orden, nombre, inicio, fin, receso, niveles)
WHERE NOT EXISTS (
  SELECT 1 FROM horario_periodos hp
  WHERE hp."anioEscolar" = v.anio AND hp.orden = v.orden
);
