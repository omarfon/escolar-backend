import type { DataSource } from 'typeorm';

const PLACEHOLDER_TERRITORIAL = /\b(destino|origen|demo|e2e|fake|placeholder|test)\b/i;

export function isPlaceholderTerritorialValue(value: string | null | undefined): boolean {
  const text = (value ?? '').trim();
  if (!text) return true;
  return PLACEHOLDER_TERRITORIAL.test(text);
}

export function institutionHasPlaceholderPadron(row: {
  ugel?: string | null;
  dre?: string | null;
  nombre?: string | null;
}): boolean {
  if (isPlaceholderTerritorialValue(row.ugel)) return true;
  if (isPlaceholderTerritorialValue(row.dre)) return true;
  const nombre = (row.nombre ?? '').trim();
  if (/\be2e\b/i.test(nombre)) return true;
  return false;
}

export async function assertPadronProductionSafe(
  ds: DataSource,
  nodeEnv = process.env.NODE_ENV ?? 'development',
): Promise<void> {
  if (nodeEnv !== 'production') return;

  const rows = (await ds.query(`
    SELECT id, nombre, "codigoModular", ugel, dre
    FROM institutions
    WHERE "codigoModular" <> ''
  `)) as Array<{
    id: number;
    nombre: string;
    codigoModular: string;
    ugel: string;
    dre: string;
  }>;

  const invalid = rows.filter((row) => institutionHasPlaceholderPadron(row));
  if (!invalid.length) return;

  const detalle = invalid
    .slice(0, 5)
    .map((row) => `${row.codigoModular} (${row.nombre}): UGEL=${row.ugel}, DRE=${row.dre}`)
    .join('; ');
  throw new Error(
    `Padrón institucional inválido en producción: ${invalid.length} IE(s) con UGEL/DRE placeholder o E2E. ${detalle}`,
  );
}
