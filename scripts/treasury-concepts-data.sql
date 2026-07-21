-- Conceptos de pago para tesorería (carga manual, no seed en runtime).
-- Uso: npm run db:treasury-concepts-data
-- Requisito: backend iniciado al menos una vez (tablas TypeORM).

INSERT INTO payment_concepts (codigo, nombre, descripcion, monto, tipo, periodicidad, nivel, activo, created_at)
VALUES
  ('MAT-PRIM', 'Matrícula Primaria', 'Matrícula anual — nivel Primaria', 350.00, 'obligatorio', 'anual', 'Primaria', true, NOW()),
  ('MENS-PRIM', 'Mensualidad Primaria', 'Pensión mensual — nivel Primaria', 320.00, 'obligatorio', 'mensual', 'Primaria', true, NOW()),
  ('MAT-SEC', 'Matrícula Secundaria', 'Matrícula anual — nivel Secundaria', 420.00, 'obligatorio', 'anual', 'Secundaria', true, NOW()),
  ('MENS-SEC', 'Mensualidad Secundaria', 'Pensión mensual — nivel Secundaria', 380.00, 'obligatorio', 'mensual', 'Secundaria', true, NOW()),
  ('CP-001', 'Matrícula', 'Derecho de matrícula al inicio del año escolar.', 250.00, 'obligatorio', 'anual', 'Todos', true, NOW()),
  ('CP-002', 'Pensión de Enseñanza', 'Cuota mensual por servicios educativos.', 320.00, 'obligatorio', 'mensual', 'Primaria', true, NOW()),
  ('CP-003', 'Pensión de Enseñanza Sec.', 'Cuota mensual por servicios educativos nivel secundaria.', 380.00, 'obligatorio', 'mensual', 'Secundaria', true, NOW()),
  ('CP-004', 'Pensión de Enseñanza Ini.', 'Cuota mensual por servicios educativos nivel inicial.', 280.00, 'obligatorio', 'mensual', 'Inicial', true, NOW()),
  ('CP-005', 'Material Educativo', 'Kit de materiales de trabajo del bimestre.', 85.00, 'obligatorio', 'bimestral', 'Todos', true, NOW()),
  ('CP-006', 'Seguro Estudiantil', 'Seguro de accidentes y salud para el alumno.', 60.00, 'obligatorio', 'anual', 'Todos', true, NOW()),
  ('CP-007', 'Actividades Extracurriculares', 'Talleres opcionales de arte, deporte y música.', 120.00, 'voluntario', 'mensual', 'Todos', true, NOW()),
  ('CP-008', 'Uniforme Escolar', 'Set completo de uniforme: diario y educación física.', 190.00, 'voluntario', 'unico', 'Todos', true, NOW()),
  ('CP-009', 'Derecho de Examen', 'Derecho de aplicación de exámenes bimestrales.', 45.00, 'obligatorio', 'bimestral', 'Secundaria', true, NOW()),
  ('CP-010', 'Visita de Estudios', 'Excursión pedagógica programada por el área académica.', 150.00, 'eventual', 'unico', 'Todos', true, NOW()),
  ('CP-011', 'APAFA', 'Aportación a la Asociación de Padres de Familia.', 80.00, 'voluntario', 'anual', 'Todos', true, NOW()),
  ('CP-012', 'Fotocopias y Recursos', 'Material fotocopiado y recursos de aula adicionales.', 30.00, 'obligatorio', 'mensual', 'Todos', true, NOW()),
  ('CP-013', 'Graduación Primaria', 'Ceremonia de graduación al concluir educación primaria.', 200.00, 'eventual', 'unico', 'Primaria', false, NOW()),
  ('CP-014', 'Graduación Secundaria', 'Ceremonia de graduación al concluir educación secundaria.', 350.00, 'eventual', 'unico', 'Secundaria', false, NOW()),
  ('CP-015', 'Taller de Computación', 'Laboratorio de informática y programación básica (nivel primaria).', 95.00, 'voluntario', 'mensual', 'Primaria', true, NOW())
ON CONFLICT (codigo) DO NOTHING;
