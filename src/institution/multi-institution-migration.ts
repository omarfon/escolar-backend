import { DataSource } from 'typeorm';

export type PadronInstitucionSeed = {
  nombre: string;
  siglas: string;
  codigoModular: string;
  ugel: string;
  dre: string;
};

/** IE base con UGEL/DRE reales (apto prod-like). */
export const PADRON_PROD_LIKE: PadronInstitucionSeed[] = [
  {
    nombre: 'I.E. San Juan Bautista',
    siglas: 'IESJB',
    codigoModular: '1111111',
    ugel: 'UGEL 02',
    dre: 'DRE Lima',
  },
  {
    nombre: 'I.E. Santa Rosa',
    siglas: 'IESR',
    codigoModular: '2222222',
    ugel: 'UGEL 03',
    dre: 'DRE Lima',
  },
];

/** IE adicional solo dev/E2E (traslados destino). */
export const PADRON_DEMO_E2E: PadronInstitucionSeed[] = [
  {
    nombre: 'I.E. Francisco Bolognesi',
    siglas: 'IEFB',
    codigoModular: '7654321',
    ugel: 'UGEL 04 Lima',
    dre: 'DRE Lima Metropolitana',
  },
];

export interface PrepareMultiInstitutionOptions {
  includeDemoPadron?: boolean;
}

async function syncPadronMetadata(ds: DataSource, padron: PadronInstitucionSeed[]): Promise<void> {
  for (const ie of padron) {
    await ds.query(
      `
      UPDATE institutions
      SET nombre = $1::varchar, siglas = $2::varchar, ugel = $4::varchar, dre = $5::varchar
      WHERE "codigoModular" = $3::varchar
      `,
      [ie.nombre, ie.siglas, ie.codigoModular, ie.ugel, ie.dre],
    );
  }
}

async function upsertPadronInstitutions(
  ds: DataSource,
  padron: PadronInstitucionSeed[],
): Promise<void> {
  for (const ie of padron) {
    await ds.query(
      `
      INSERT INTO institutions (
        nombre, siglas, "codigoModular", "tipoGestion", ugel, dre, anio,
        "sistemaEval", "tipoPeriodo", "notaMinima",
        "escalaLogro", niveles, periodos, config, modulos
      )
      SELECT $1::varchar, $2::varchar, $3::varchar, 'publica', $4::varchar, $5::varchar, '2026',
        'numerico', 'bimestre', 11,
        '{"AD":17.5,"A":14,"B":11}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM institutions WHERE "codigoModular" = $3::varchar
      )
      `,
      [ie.nombre, ie.siglas, ie.codigoModular, ie.ugel, ie.dre],
    );
  }
}

/**
 * Varias IE en el mismo padrón: alumnos quedan en su institución,
 * y las solicitudes de traslado apuntan a una IE registrada.
 */
export async function prepareMultiInstitution(
  ds: DataSource,
  options: PrepareMultiInstitutionOptions = {},
): Promise<void> {
  const includeDemoPadron = options.includeDemoPadron ?? true;
  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "institutionId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "ieOrigenInstitutionId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE transfer_requests
    ADD COLUMN IF NOT EXISTS "ieDestinoInstitutionId" integer NULL
  `);

  await upsertPadronInstitutions(ds, PADRON_PROD_LIKE);
  await syncPadronMetadata(ds, PADRON_PROD_LIKE);
  if (includeDemoPadron) {
    await upsertPadronInstitutions(ds, PADRON_DEMO_E2E);
    await syncPadronMetadata(ds, PADRON_DEMO_E2E);
    await seedDemoTransferUsers(ds);
  }

  await normalizeMultiInstitutionData(ds);
}

async function normalizeMultiInstitutionData(ds: DataSource): Promise<void> {

  await ds.query(`
    UPDATE students s
    SET "institutionId" = keeper.id
    FROM institutions dup
    JOIN institutions keeper
      ON keeper."codigoModular" = dup."codigoModular" AND keeper.id < dup.id
    WHERE s."institutionId" = dup.id
  `);
  await ds.query(`
    UPDATE transfer_requests t
    SET "ieOrigenInstitutionId" = keeper.id
    FROM institutions dup
    JOIN institutions keeper
      ON keeper."codigoModular" = dup."codigoModular" AND keeper.id < dup.id
    WHERE t."ieOrigenInstitutionId" = dup.id
  `);
  await ds.query(`
    UPDATE transfer_requests t
    SET "ieDestinoInstitutionId" = keeper.id
    FROM institutions dup
    JOIN institutions keeper
      ON keeper."codigoModular" = dup."codigoModular" AND keeper.id < dup.id
    WHERE t."ieDestinoInstitutionId" = dup.id
  `);
  await ds.query(`
    UPDATE user_role_assignments a
    SET activo = false, "revokedAt" = now()
    FROM institutions dup
    JOIN institutions keeper
      ON keeper."codigoModular" = dup."codigoModular" AND keeper.id < dup.id
    WHERE a."institutionId" = dup.id AND a.activo = true
  `);
  await ds.query(`
    DELETE FROM institutions a
    USING institutions b
    WHERE a."codigoModular" = b."codigoModular"
      AND a."codigoModular" <> ''
      AND a.id > b.id
  `);
  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_institutions_codigo_modular
    ON institutions ("codigoModular")
    WHERE "codigoModular" <> ''
  `);

  await ds.query(`
    UPDATE students
    SET "institutionId" = (SELECT id FROM institutions ORDER BY id ASC LIMIT 1)
    WHERE "institutionId" IS NULL
  `);

  await ds.query(`
    UPDATE transfer_requests t
    SET "ieOrigenInstitutionId" = i.id
    FROM institutions i
    WHERE t."ieOrigenCodigoModular" = i."codigoModular"
      AND t."ieOrigenInstitutionId" IS NULL
  `);
  await ds.query(`
    UPDATE transfer_requests t
    SET "ieDestinoInstitutionId" = i.id
    FROM institutions i
    WHERE t."ieDestinoCodigoModular" = i."codigoModular"
      AND t."ieDestinoInstitutionId" IS NULL
  `);

  await ds.query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS "codigoNacional" varchar(40) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    ALTER TABLE student_academic_history
    ADD COLUMN IF NOT EXISTS "institutionId" integer NULL
  `);
  await ds.query(`
    ALTER TABLE student_academic_history
    ADD COLUMN IF NOT EXISTS "codigoInstitucion" varchar(20) NOT NULL DEFAULT ''
  `);
  await ds.query(`
    UPDATE students
    SET "codigoNacional" = CASE
      WHEN dni IS NOT NULL AND btrim(dni) <> ''
        THEN upper(COALESCE(NULLIF(btrim("tipoDocumento"), ''), 'DNI')) || '-' || btrim(dni)
      ELSE 'ALU-' || lpad(id::text, 6, '0')
    END
    WHERE "codigoNacional" = ''
  `);
  await ds.query(`
    UPDATE student_academic_history h
    SET "institutionId" = s."institutionId"
    FROM students s
    WHERE h."studentId" = s.id
      AND h."institutionId" IS NULL
      AND s."institutionId" IS NOT NULL
  `);
  await ds.query(`
    UPDATE student_academic_history h
    SET "codigoInstitucion" = i."codigoModular"
    FROM institutions i
    WHERE h."institutionId" = i.id
      AND h."codigoInstitucion" = ''
  `);
}

async function seedDemoTransferUsers(ds: DataSource): Promise<void> {
  await ds.query(`
    INSERT INTO users (
      nombres, apellidos, dni, email, username, rol, password, cargo, estado, sede
    )
    SELECT
      'Elena', 'Ramos Vega', '47000111', 'elena.ramos@escolar.pe', 'e.ramos',
      'SECRETARIA', u.password, 'Secretaria IE Santa Rosa', 'activo', 'Sede Central'
    FROM users u
    WHERE u.username = 'r.huanca'
      AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'e.ramos')
  `);

  await ds.query(`
    INSERT INTO user_role_assignments (
      "userId", "roleCodigo", ambito, "institutionId", "esPrincipal", activo, motivo
    )
    SELECT u.id, 'SECRETARIA', 'IE', i.id, true, true, 'Secretaría de la IE Santa Rosa'
    FROM users u
    JOIN institutions i ON i."codigoModular" = '2222222'
    WHERE u.username = 'e.ramos'
      AND NOT EXISTS (
        SELECT 1 FROM user_role_assignments a
        WHERE a."userId" = u.id AND a.activo = true AND a."institutionId" = i.id
      )
  `);

  await ds.query(`
    INSERT INTO users (
      nombres, apellidos, dni, email, username, rol, password, cargo, estado, sede
    )
    SELECT
      'María', 'Destino Vega', '47000222', 'm.destino@escolar.pe', 'm.destino',
      'SECRETARIA', u.password, 'Secretaria IE Francisco Bolognesi', 'activo', 'Sede Central'
    FROM users u
    WHERE u.username = 'r.huanca'
      AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'm.destino')
  `);

  await ds.query(`
    INSERT INTO user_role_assignments (
      "userId", "roleCodigo", ambito, "institutionId", "esPrincipal", activo, motivo
    )
    SELECT u.id, 'SECRETARIA', 'IE', i.id, true, true, 'Secretaría de la IE de destino E2E'
    FROM users u
    JOIN institutions i ON i."codigoModular" = '7654321'
    WHERE u.username = 'm.destino'
      AND NOT EXISTS (
        SELECT 1 FROM user_role_assignments a
        WHERE a."userId" = u.id AND a.activo = true AND a."institutionId" = i.id
      )
  `);
}
