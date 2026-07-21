-- =============================================================================
-- Datos demo de bitácora del sistema (tabla audit_logs)
-- Fuente de verdad: PostgreSQL — retención automática de 15 días en el backend
--
-- Ejecutar: npm run db:bitacora-data
-- Requisito: backend iniciado al menos una vez (tabla audit_logs creada por TypeORM)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER,
  "usuarioNombre" VARCHAR(120) NOT NULL DEFAULT '',
  "usuarioRol" VARCHAR(60) NOT NULL DEFAULT '',
  accion VARCHAR(20) NOT NULL DEFAULT 'consultar',
  modulo VARCHAR(60) NOT NULL DEFAULT '',
  entidad VARCHAR(80) NOT NULL DEFAULT '',
  "entidadId" VARCHAR(60),
  descripcion TEXT NOT NULL DEFAULT '',
  detalle JSONB,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  nivel VARCHAR(10) NOT NULL DEFAULT 'info',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs ("createdAt");

WITH bitacora_seed(
  "usuarioId", "usuarioNombre", "usuarioRol", accion, modulo, entidad,
  "entidadId", descripcion, detalle, ip, nivel, dias_atras, hora
) AS (
  VALUES
    (1, 'Carlos Mendoza', 'ADMIN', 'login', 'autenticacion', 'sesion', NULL,
     'Inicio de sesión exitoso', '{"navegador":"Chrome 125","dispositivo":"Windows"}'::jsonb,
     '192.168.1.10', 'info', 0, '08:30:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'configurar', 'institucion', 'configuracion', '1',
     'Actualizó datos generales de la institución', '{"campos":["director","anio","notaMinima"]}'::jsonb,
     '192.168.1.10', 'info', 0, '09:12:00'),
    (2, 'Ana Garcia', 'SECRETARIA', 'crear', 'matricula', 'estudiante', '2026-045',
     'Registró nueva matrícula: Sofia Ramos Cruz — 5° Primaria A', '{"dni":"72345123","nivel":"Primaria","grado":"5°"}'::jsonb,
     '192.168.1.22', 'info', 1, '10:45:00'),
    (3, 'J. Pérez', 'DOCENTE', 'publicar', 'recursos', 'material', '12',
     'Publicó tarea "Problemas con fracciones" en Matemática 5°A', '{"tipo":"tarea","fechaEntrega":"2026-06-24"}'::jsonb,
     '10.0.0.55', 'info', 1, '15:20:00'),
    (3, 'J. Pérez', 'DOCENTE', 'actualizar', 'asistencia', 'asistencia', '2026-06-14',
     'Registró asistencia del 14/06 — Matemática 5°A (28 presentes, 2 faltas)', NULL,
     '10.0.0.55', 'info', 1, '16:05:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'aprobar', 'evaluacion', 'acta', '3',
     'Aprobó acta de evaluación — Matemática 5°A, 2° Bimestre', NULL,
     '192.168.1.10', 'info', 2, '11:30:00'),
    (2, 'Ana Garcia', 'SECRETARIA', 'crear', 'comunicaciones', 'comunicado', '8',
     'Publicó comunicado "Calendario de evaluaciones — 2° Bimestre"', '{"destinatarios":"alumnos","prioridad":"media"}'::jsonb,
     '192.168.1.22', 'info', 2, '09:00:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'actualizar', 'usuarios', 'usuario', '15',
     'Restableció contraseña del usuario docente.matematica', NULL,
     '192.168.1.10', 'warning', 3, '14:18:00'),
    (NULL, 'Sistema', 'SISTEMA', 'consultar', 'asistencia', 'alerta', NULL,
     'Generó 4 alertas de ausentismo crítico para Primaria 5°', '{"alertas":4,"nivel":"critico"}'::jsonb,
     '', 'warning', 3, '07:00:00'),
    (2, 'Ana Garcia', 'SECRETARIA', 'eliminar', 'matricula', 'lista_espera', '7',
     'Eliminó solicitud de lista de espera — DNI 72345682', NULL,
     '192.168.1.22', 'warning', 4, '16:40:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'exportar', 'evaluacion', 'promedios', NULL,
     'Exportó reporte de promedios — Primaria 5°, 2° Bimestre', '{"formato":"PDF","registros":32}'::jsonb,
     '192.168.1.10', 'info', 5, '10:15:00'),
    (4, 'Maria Lopez', 'PADRE', 'login', 'autenticacion', 'sesion', NULL,
     'Inicio de sesión en portal de padres', NULL,
     '201.234.56.78', 'info', 6, '19:30:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'rechazar', 'asistencia', 'justificacion', '5',
     'Rechazó justificación de falta — documento incompleto', '{"estudiante":"Carlos Mendoza Ruiz","fecha":"2026-06-08"}'::jsonb,
     '192.168.1.10', 'critical', 7, '12:00:00'),
    (3, 'J. Pérez', 'DOCENTE', 'actualizar', 'evaluacion', 'nota', '156',
     'Ingresó notas del examen bimestral — Matemática 5°A', '{"alumnos":30,"bimestre":2}'::jsonb,
     '10.0.0.55', 'info', 8, '17:45:00'),
    (1, 'Carlos Mendoza', 'ADMIN', 'logout', 'autenticacion', 'sesion', NULL,
     'Cierre de sesión', NULL,
     '192.168.1.10', 'info', 9, '18:00:00')
)
INSERT INTO audit_logs (
  "usuarioId", "usuarioNombre", "usuarioRol", accion, modulo, entidad,
  "entidadId", descripcion, detalle, ip, nivel, "createdAt"
)
SELECT
  b."usuarioId",
  b."usuarioNombre",
  b."usuarioRol",
  b.accion,
  b.modulo,
  b.entidad,
  b."entidadId",
  b.descripcion,
  b.detalle,
  b.ip,
  b.nivel,
  (CURRENT_DATE - b.dias_atras * INTERVAL '1 day') + b.hora::time
FROM bitacora_seed b
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs existing
  WHERE existing.descripcion = b.descripcion
    AND existing.modulo = b.modulo
    AND existing.accion = b.accion
);

COMMIT;
