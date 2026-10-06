import { DataSource } from 'typeorm';

export async function prepareSiagieAccess(ds: DataSource): Promise<void> {
  await ds.query(`
    INSERT INTO roles (codigo, label, descripcion, color, "esAdmin", orden)
    SELECT
      'SIAGIE',
      'SIAGIE',
      'Superusuario nacional: administra y visualiza todas las instituciones, sedes y alumnos',
      'bg-slate-900',
      true,
      11
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE codigo = 'SIAGIE')
  `);

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT siagie.id, rp."permissionId"
    FROM roles siagie
    JOIN roles admin ON admin.codigo = 'ADMIN'
    JOIN role_permissions rp ON rp."roleId" = admin.id
    WHERE siagie.codigo = 'SIAGIE'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions existente
        WHERE existente."roleId" = siagie.id
          AND existente."permissionId" = rp."permissionId"
      )
  `);

  await ds.query(`
    INSERT INTO users (
      nombres, apellidos, dni, email, username, rol, password, cargo, estado, sede
    )
    SELECT
      'SIAGIE', 'Nacional', '90000001', 'siagie@escolar.pe', 'siagie',
      'SIAGIE', u.password, 'Superusuario SIAGIE', 'activo', 'Nacional'
    FROM users u
    WHERE u.username = 'admin'
      AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'siagie')
  `);

  await ds.query(`
    INSERT INTO user_role_assignments (
      "userId", "roleCodigo", ambito, "institutionId", "esPrincipal", activo, motivo
    )
    SELECT u.id, 'SIAGIE', 'MINEDU', NULL, true, true, 'Superusuario SIAGIE'
    FROM users u
    WHERE u.username = 'siagie'
      AND NOT EXISTS (
        SELECT 1 FROM user_role_assignments a
        WHERE a."userId" = u.id AND a.activo = true AND a."roleCodigo" = 'SIAGIE'
      )
  `);
}
