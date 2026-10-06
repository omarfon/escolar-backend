import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/utils/password-crypto.util';

export const CLAVE_INICIAL_ADMINISTRADOR_SEDE = 'Admin123';

type SqlRunner = {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};

export function codigoAdministradorSede(institutionId: number): string {
  return `ADM${institutionId}`;
}

export function esAdministradorDeSede(codigo: string, institutionId?: number | null): boolean {
  return institutionId != null && codigo === codigoAdministradorSede(institutionId);
}

export async function ensureAdministradorDeSede(
  db: SqlRunner,
  institution: { id: number; nombre: string },
): Promise<string> {
  const codigo = codigoAdministradorSede(institution.id);
  const descripcion = `Crea los roles de la sede y configura ${institution.nombre}`.slice(0, 200);
  const existentes = (await db.query(`SELECT id FROM roles WHERE codigo = $1`, [codigo])) as { id: number }[];
  let roleId = existentes[0]?.id;

  if (!roleId) {
    const insertados = (await db.query(
      `INSERT INTO roles (codigo, label, descripcion, color, "esAdmin", orden, "institutionId")
       VALUES ($1, $2, $3, $4, false, $5, $6)
       RETURNING id`,
      [codigo, 'Administrador de sede', descripcion, 'bg-indigo-600', 50 + institution.id, institution.id],
    )) as { id: number }[];
    roleId = insertados[0]?.id;
  }

  if (!roleId) return codigo;

  await db.query(
    `INSERT INTO role_permissions ("roleId", "permissionId")
     SELECT $1, rp."permissionId"
     FROM roles admin
     JOIN role_permissions rp ON rp."roleId" = admin.id
     WHERE admin.codigo = 'ADMIN'
       AND NOT EXISTS (
         SELECT 1 FROM role_permissions existente
         WHERE existente."roleId" = $1
           AND existente."permissionId" = rp."permissionId"
       )`,
    [roleId],
  );

  return codigo;
}

export function usernameAdministradorSede(codigoModular: string): string {
  const limpio = codigoModular.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  return `adm${limpio || 'sede'}`.slice(0, 50);
}

export async function ensureCredencialesAdministrador(
  db: SqlRunner,
  institution: { id: number; nombre: string; codigoModular: string },
): Promise<{ username: string; password: string; creado: boolean }> {
  const rol = codigoAdministradorSede(institution.id);
  const asignado = (await db.query(
    `SELECT u.username
     FROM user_role_assignments a
     JOIN users u ON u.id = a."userId"
     WHERE a."roleCodigo" = $1 AND a.activo = true
     LIMIT 1`,
    [rol],
  )) as { username: string }[];
  if (asignado[0]) {
    return { username: asignado[0].username, password: '', creado: false };
  }

  const username = await usernameLibre(db, usernameAdministradorSede(institution.codigoModular), institution.id);
  const email = `${username}@escolar.pe`.slice(0, 120);
  const dni = await dniLibre(db, institution);
  const insertados = (await db.query(
    `INSERT INTO users (
       nombres, apellidos, dni, email, username, telefono, rol, sede, estado, cargo, password
     ) VALUES ($1, $2, $3, $4, $5, '', $6, $7, 'activo', 'Administrador de sede', $8)
     RETURNING id`,
    [
      'Administrador',
      institution.nombre.slice(0, 80),
      dni,
      email,
      username,
      rol,
      institution.nombre.slice(0, 80),
      hashPassword(CLAVE_INICIAL_ADMINISTRADOR_SEDE),
    ],
  )) as { id: number }[];

  await db.query(
    `INSERT INTO user_role_assignments
      ("userId", "roleCodigo", ambito, "institutionId", "esPrincipal", activo, motivo)
     VALUES ($1, $2, 'IE', $3, true, true, 'Credencial inicial del administrador de sede')`,
    [insertados[0].id, rol, institution.id],
  );

  return { username, password: CLAVE_INICIAL_ADMINISTRADOR_SEDE, creado: true };
}

async function usernameLibre(db: SqlRunner, base: string, institutionId: number): Promise<string> {
  let candidato = base.slice(0, 50);
  let n = 0;
  while (n < 20) {
    const rows = (await db.query(`SELECT id FROM users WHERE username = $1 OR email = $2`, [
      candidato,
      `${candidato}@escolar.pe`,
    ])) as { id: number }[];
    if (!rows.length) return candidato;
    n += 1;
    candidato = `${base}${institutionId}${n}`.slice(0, 50);
  }
  return `adm${institutionId}${Date.now()}`.slice(0, 50);
}

async function dniLibre(
  db: SqlRunner,
  institution: { id: number; codigoModular: string },
): Promise<string> {
  const digitos = institution.codigoModular.replace(/\D/g, '').padStart(7, '0').slice(-7);
  const candidatos = [`9${digitos}`.slice(0, 8), String(80000000 + institution.id).slice(0, 8)];
  for (const dni of candidatos) {
    const rows = (await db.query(`SELECT id FROM users WHERE dni = $1`, [dni])) as { id: number }[];
    if (!rows.length && dni.length === 8) return dni;
  }
  for (let n = 0; n < 50; n += 1) {
    const dni = String(80000000 + institution.id + n).padStart(8, '0').slice(0, 8);
    const rows = (await db.query(`SELECT id FROM users WHERE dni = $1`, [dni])) as { id: number }[];
    if (!rows.length) return dni;
  }
  return String(80000000 + institution.id).padStart(8, '0').slice(0, 8);
}

export async function prepareSedeAdminRoles(ds: DataSource): Promise<void> {
  const tabla = await ds.query(`SELECT to_regclass('public.roles') AS nombre`);
  if (!tabla[0]?.nombre) return;

  await ds.query(`ALTER TABLE users ALTER COLUMN password TYPE varchar(255)`);
  await ds.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS "institutionId" integer NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_roles_institution ON roles ("institutionId")`);

  const instituciones = (await ds.query(
    `SELECT id, nombre, "codigoModular" FROM institutions ORDER BY id`,
  )) as { id: number; nombre: string; codigoModular: string }[];

  for (const institucion of instituciones) {
    await ensureAdministradorDeSede(ds, institucion);
    await ensureCredencialesAdministrador(ds, institucion);
  }

  await ds.query(`
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.codigo IN (
      'evaluacion.ver', 'evaluacion.reportes', 'horarios.ver', 'traslados.aprobar_destino'
    )
    WHERE r.codigo = 'SECRETARIA'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
      )
  `);
}
