import { DataSource } from 'typeorm';

export async function prepareCurriculaPermissions(ds: DataSource): Promise<void> {
  await ds.query(`
    INSERT INTO permissions (codigo, label, modulo, icono, orden)
    SELECT v.codigo, v.label, 'Currícula', 'menu_book', v.orden
    FROM (VALUES
      ('curricula.ver', 'Consultar plan de estudios y áreas', 220),
      ('curricula.gestionar', 'Registrar y modificar áreas del plan de estudios', 221)
    ) AS v(codigo, label, orden)
    WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.codigo = v.codigo)
  `);

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON (
      (r.codigo IN ('ADMIN', 'DIRECTOR') AND p.codigo LIKE 'curricula.%')
      OR (r.codigo = 'SECRETARIA' AND p.codigo = 'curricula.ver')
      OR (r.codigo = 'SIAGIE' AND p.codigo LIKE 'curricula.%')
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
    )
  `);
}
