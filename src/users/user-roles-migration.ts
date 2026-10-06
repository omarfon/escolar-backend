import { DataSource } from 'typeorm';

export async function prepareUserRoleAssignmentsTable(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS user_role_assignments (
      id SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "roleCodigo" varchar(30) NOT NULL,
      ambito varchar(10) NOT NULL DEFAULT 'IE',
      "dreCodigo" varchar(40) NULL,
      "ugelCodigo" varchar(40) NULL,
      "institutionId" integer NULL,
      "esPrincipal" boolean NOT NULL DEFAULT false,
      activo boolean NOT NULL DEFAULT true,
      motivo text NOT NULL DEFAULT '',
      "createdByUserId" integer NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "revokedAt" timestamp NULL
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_user_role_active
    ON user_role_assignments ("userId", activo)
  `);

  const [{ exists }] = await ds.query<[{ exists: boolean }]>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'idx_user_role_unique_scope'
    ) AS exists`,
  );

  if (!exists) {
    await ds.query(`
      CREATE UNIQUE INDEX idx_user_role_unique_scope
      ON user_role_assignments (
        "userId", "roleCodigo", ambito,
        COALESCE("dreCodigo", ''), COALESCE("ugelCodigo", ''), COALESCE("institutionId", 0)
      )
      WHERE activo = true
    `);
  }

  const [{ count }] = await ds.query<[{ count: string }]>(
    `SELECT COUNT(*)::text AS count FROM user_role_assignments`,
  );
  if (Number(count) > 0) return;

  const institution = await ds.query<{ id: number }[]>(
    `SELECT id FROM institutions ORDER BY id ASC LIMIT 1`,
  );
  const institutionId = institution[0]?.id ?? null;

  const users = await ds.query<{ id: number; rol: string }[]>(
    `SELECT id, rol FROM users WHERE rol IS NOT NULL AND rol <> ''`,
  );

  for (const user of users) {
    const existing = await ds.query<{ id: number }[]>(
      `SELECT id FROM user_role_assignments
       WHERE "userId" = $1 AND activo = true LIMIT 1`,
      [user.id],
    );
    if (existing.length) continue;

    await ds.query(
      `INSERT INTO user_role_assignments
        ("userId", "roleCodigo", ambito, "institutionId", "esPrincipal", activo, motivo)
       VALUES ($1, $2, 'IE', $3, true, true, 'Migración desde rol único legacy')`,
      [user.id, user.rol, institutionId],
    );
  }
}
