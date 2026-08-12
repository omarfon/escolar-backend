import { DataSource } from 'typeorm';
import {
  abrevDocente,
  maxHorasForTipo,
  tipoFromEspecialidad,
} from './entities/docente.entity';

export async function ensureDocenteProfileColumns(ds: DataSource): Promise<void> {
  const hasTable = await ds.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'docentes'
  `);
  if (!hasTable.length) return;

  await ds.query(`
    ALTER TABLE docentes
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(200) NOT NULL DEFAULT ''
  `);
}

/**
 * Sincroniza docentes desde users (rol DOCENTE) y remapea FKs legacy userId → docentes.id
 */
export async function prepareDocentesTable(ds: DataSource): Promise<void> {
  await ensureDocenteProfileColumns(ds);

  const hasTable = await ds.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'docentes'
  `);
  if (!hasTable.length) return;

  const users: Array<{
    id: number;
    nombres: string;
    apellidos: string;
    dni: string;
    email: string;
    username: string;
    telefono: string;
    sede: string;
    estado: string;
    cargo: string;
  }> = await ds.query(`SELECT * FROM users WHERE rol = 'DOCENTE'`);

  for (const u of users) {
    const especialidad = (u.cargo ?? '').trim() || 'Docente';
    const tipo = tipoFromEspecialidad(especialidad);
    const existing: Array<{ id: number }> = await ds.query(
      `SELECT id FROM docentes WHERE "userId" = $1 OR email = $2 OR dni = $3 LIMIT 1`,
      [u.id, u.email, u.dni],
    );

    if (existing.length) {
      await ds.query(
        `UPDATE docentes SET
          "userId" = COALESCE("userId", $1),
          nombres = $2, apellidos = $3, email = $4, username = $5,
          telefono = $6, sede = $7, estado = $8, especialidad = $9,
          tipo = $10, "maxHoras" = $11, abrev = $12
        WHERE id = $13`,
        [
          u.id,
          u.nombres,
          u.apellidos,
          u.email,
          u.username,
          u.telefono ?? '',
          u.sede ?? 'Sede Central',
          u.estado ?? 'activo',
          especialidad,
          tipo,
          maxHorasForTipo(tipo),
          abrevDocente(u.nombres, u.apellidos),
          existing[0].id,
        ],
      );
    } else {
      await ds.query(
        `INSERT INTO docentes (
          "userId", nombres, apellidos, dni, email, username, telefono,
          sede, estado, especialidad, tipo, "maxHoras", abrev
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          u.id,
          u.nombres,
          u.apellidos,
          u.dni,
          u.email,
          u.username,
          u.telefono ?? '',
          u.sede ?? 'Sede Central',
          u.estado ?? 'activo',
          especialidad,
          tipo,
          maxHorasForTipo(tipo),
          abrevDocente(u.nombres, u.apellidos),
        ],
      );
    }
  }

  await ds.query(`
    UPDATE curricula_teacher_assignments cta
    SET "docenteId" = d.id
    FROM docentes d
    WHERE cta."docenteId" IS NOT NULL
      AND cta."docenteId" = d."userId"
      AND NOT EXISTS (SELECT 1 FROM docentes d2 WHERE d2.id = cta."docenteId")
  `);

  await ds.query(`
    UPDATE horario_blocks hb
    SET "docenteId" = d.id
    FROM docentes d
    WHERE hb."docenteId" IS NOT NULL
      AND hb."docenteId" = d."userId"
      AND NOT EXISTS (SELECT 1 FROM docentes d2 WHERE d2.id = hb."docenteId")
  `);
}
