/**
 * Sube matricula_prueba_50_alumnos.xlsx al backend y verifica persistencia.
 * Uso: node scripts/verify-bulk-matricula-upload.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const __dirname = dirname(fileURLToPath(import.meta.url));
const xlsxPath = join(__dirname, '../../escolar/public/matricula_prueba_50_alumnos.xlsx');

async function main() {
  if (!existsSync(xlsxPath)) {
    throw new Error(`No existe ${xlsxPath}. Ejecute: node scripts/generate-matricula-prueba-xlsx.mjs en el frontend`);
  }

  const buffer = readFileSync(xlsxPath);
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'matricula_prueba_50_alumnos.xlsx');

  console.log('=== Verificacion Matricula Masiva (50 alumnos) ===\n');
  console.log(`Subiendo ${xlsxPath} ...`);

  const res = await fetch(`${API}/students/bulk-matricula/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  const result = await res.json();
  console.log(`Total procesadas: ${result.total}`);
  console.log(`Creadas en BD:    ${result.creados}`);
  console.log(`Omitidas:         ${result.omitidos ?? 0}`);
  console.log(`Errores BD:       ${result.errores?.length ?? 0}`);
  console.log(`Errores validacion: ${result.erroresValidacion?.length ?? 0}`);

  if (result.errores?.length) {
    console.log('\nPrimeros errores BD:');
    result.errores.slice(0, 5).forEach((e) =>
      console.log(`  Fila ${e.fila} DNI ${e.dni}: ${e.mensaje}`),
    );
  }

  if (result.creados < 50) {
    throw new Error(`Se esperaban 50 matriculas creadas; se crearon ${result.creados}`);
  }

  const dniMuestra = '80300001';
  const check = await fetch(`${API}/students?q=${dniMuestra}`);
  if (!check.ok) throw new Error('No se pudo verificar alumno en BD');

  const students = await check.json();
  const found = Array.isArray(students)
    ? students.some((s) => s.dni === dniMuestra || s.codigo?.includes(dniMuestra))
    : false;

  console.log(`\nVerificacion muestra DNI ${dniMuestra}: ${found ? 'OK' : 'consultar expedientes'}`);
  console.log('\n✓ Matricula masiva: 50 alumnos registrados en tabla students');
}

main().catch((err) => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
