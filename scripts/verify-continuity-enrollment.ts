/**
 * Simula la carga de 10 matrículas por continuidad desde el front
 * y verifica persistencia en PostgreSQL (tabla continuity_enrollments).
 *
 * Uso: npx ts-node scripts/verify-continuity-enrollment.ts
 */
const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const ANIO_ORIGEN = 2025;
const ANIO_NUEVO = 2026;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${url}: ${text}`);
  }
  return res.json() as Promise<T>;
}

interface Candidate {
  id: number;
  generado: boolean;
  situacion: string;
  seccionPropuesta: string;
}

interface GenerateResult {
  createdCount: number;
  created: Array<{ id: number; estudianteId: number; estado: string }>;
}

async function main() {
  console.log('=== Verificación Matrícula por Continuidad ===\n');

  const candidates = await fetchJson<Candidate[]>(
    `${API}/continuity-enrollment/candidates?anioOrigen=${ANIO_ORIGEN}&anioNuevo=${ANIO_NUEVO}`,
  );
  console.log(`Candidatos activos: ${candidates.length}`);

  const elegibles = candidates.filter(
    (c) =>
      !c.generado &&
      c.situacion !== 'retirado' &&
      c.situacion !== 'egresado',
  );

  if (elegibles.length < 10) {
    throw new Error(
      `Se necesitan al menos 10 candidatos elegibles; hay ${elegibles.length}`,
    );
  }

  const seleccion = elegibles.slice(0, 10);
  const payload = {
    anioOrigen: ANIO_ORIGEN,
    anioNuevo: ANIO_NUEVO,
    generadoPor: 'Script Verificación Front',
    items: seleccion.map((c) => ({
      studentId: c.id,
      situacion: c.situacion,
      seccionNueva: c.seccionPropuesta !== '—' ? c.seccionPropuesta : undefined,
    })),
  };

  const result = await fetchJson<GenerateResult>(
    `${API}/continuity-enrollment/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  console.log(`Matrículas generadas: ${result.createdCount}`);
  console.log(`IDs en BD: ${result.created.map((r) => r.id).join(', ')}`);

  const pendientes = await fetchJson<Array<{ id: number; estado: string }>>(
    `${API}/continuity-enrollment?anioNuevo=${ANIO_NUEVO}&estado=pendiente`,
  );

  const idsGenerados = new Set(result.created.map((r) => r.id));
  const enBd = pendientes.filter((p) => idsGenerados.has(p.id));

  console.log(`\nVerificación API — pendientes encontrados: ${enBd.length}/10`);

  if (enBd.length !== 10) {
    throw new Error('No se confirmaron las 10 matrículas en la API');
  }

  console.log('\n✓ Verificación exitosa: 10 matrículas por continuidad guardadas en continuity_enrollments');
  console.log('  Tablas relacionadas al aprobar: students, student_academic_history');
}

main().catch((err) => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
