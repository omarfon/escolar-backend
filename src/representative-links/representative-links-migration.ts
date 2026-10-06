import { DataSource } from 'typeorm';

export async function prepareRepresentativeLinksTables(
  ds: DataSource,
): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS representatives (
      id SERIAL PRIMARY KEY,
      "tipoDocumento" varchar(15) NOT NULL DEFAULT 'DNI',
      "numeroDocumento" varchar(20) NOT NULL,
      nombres varchar(80) NOT NULL,
      apellidos varchar(80) NOT NULL DEFAULT '',
      "apellidoPaterno" varchar(80) NOT NULL DEFAULT '',
      "apellidoMaterno" varchar(80) NOT NULL DEFAULT '',
      email varchar(120) NOT NULL DEFAULT '',
      telefono varchar(30) NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_representatives_document
    ON representatives ("tipoDocumento", "numeroDocumento")
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS representative_student_links (
      id SERIAL PRIMARY KEY,
      "representativeId" integer NOT NULL,
      "studentId" integer NOT NULL,
      "tipoVinculo" varchar(30) NOT NULL DEFAULT 'apoderado',
      "esPrincipal" boolean NOT NULL DEFAULT false,
      "vigenciaDesde" date NOT NULL,
      "vigenciaHasta" date NULL,
      activo boolean NOT NULL DEFAULT true,
      "motivoCese" text NOT NULL DEFAULT '',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rep_student_active_unique
    ON representative_student_links ("representativeId", "studentId")
    WHERE activo = true
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_rep_student_student_active
    ON representative_student_links ("studentId", activo)
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS representative_link_logs (
      id SERIAL PRIMARY KEY,
      "linkId" integer NULL,
      "representativeId" integer NOT NULL,
      "studentId" integer NOT NULL,
      accion varchar(20) NOT NULL,
      "actorUserId" integer NULL,
      "actorNombre" varchar(120) NOT NULL DEFAULT '',
      "actorRol" varchar(60) NOT NULL DEFAULT '',
      motivo text NOT NULL DEFAULT '',
      cambios jsonb NOT NULL DEFAULT '{}',
      ip varchar(45) NOT NULL DEFAULT '',
      "correlationId" varchar(64) NULL,
      resultado varchar(10) NOT NULL DEFAULT 'success',
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_rep_link_logs_rep_created
    ON representative_link_logs ("representativeId", "createdAt" DESC)
  `);
}
