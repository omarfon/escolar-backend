/** Salón demo para revisión de entregas docente ↔ estudiante. */
export const ENTREGAS_DEMO_SALON = {
  nivel: 'Primaria',
  grado: '5°',
  seccion: 'A',
  anioEscolar: 2026,
} as const;

/** Dos entregas demo para probar revisión docente. */
export const ENTREGAS_DEMO_SUBMISSIONS = [
  {
    email: 'l.torres@estudiante.pe',
    titulo: 'Tarea: Problemas con fracciones',
    comentario: 'Adjunto la guía resuelta. Tuve dudas en el ejercicio 8.',
    fileName: 'entrega-fracciones-lucia.pdf',
    label: 'Entrega — Lucía Pérez López',
  },
  {
    email: 'c.mendoza@estudiante.pe',
    titulo: 'Tarea: Problemas con fracciones',
    comentario: 'Entrego mi trabajo con el procedimiento de cada ejercicio.',
    fileName: 'entrega-fracciones-carlos.pdf',
    label: 'Entrega — Carlos Pérez López',
  },
] as const;

/** PDF mínimo válido para vista previa en el portal docente. */
export function buildDemoPdfBuffer(title: string): Buffer {
  const safe = title.replace(/[()\\]/g, ' ');
  const text = `BT /F1 18 Tf 72 720 Td (${safe}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${text.length}>>stream
${text}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000353 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
500
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
