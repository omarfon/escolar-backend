-- Temario de clases (tabla temario_clases)
-- Los datos demo se cargan con: npm run db:temario-data
-- Requiere docente "docente" con asignaciones activas (npm run db:seed / db:horarios-data).

-- Ver clases existentes:
-- SELECT id, "cursoNombre", nivel, grado, seccion, titulo, "fechaClase"
-- FROM temario_clases
-- WHERE "anioEscolar" = 2026
-- ORDER BY "fechaClase", numero;
