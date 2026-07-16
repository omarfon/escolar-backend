/** Grados ingresantes: cupo total del salon (nueva matricula externa). */
export function isIngresanteGrade(nivel: string, grado: string): boolean {
  const g = normalizeGradoMatricula(grado);
  return (
    (nivel === 'Primaria' && g === '1°') ||
    (nivel === 'Secundaria' && g === '1°')
  );
}

export function normalizeGradoMatricula(grado: string): string {
  const t = grado.trim();
  if (/^\d+\s*°?$/.test(t)) {
    const n = t.replace(/[^\d]/g, '');
    return `${n}°`;
  }
  return t;
}

/** Convierte nombre institucional ("1 Grado", "1 Ano") a formato matricula ("1°"). */
export function gradoInstitucionalToMatricula(
  nivel: string,
  nombreGrado: string,
): string {
  const t = nombreGrado.trim();
  const m = t.match(/^(\d+)/);
  if (m) return `${m[1]}°`;
  if (nivel === 'Inicial') {
    const ini = t.match(/^(\d+)/);
    if (ini) return `${ini[1]}°`;
  }
  return t;
}

/** Parsea etiqueta continuidad "2° Primaria" → { grado, nivel }. */
export function splitGradoLabel(label: string): {
  grado: string;
  nivel: string;
} {
  const t = label.trim();
  const match = t.match(/^(.+?)\s+(Inicial|Primaria|Secundaria)$/i);
  if (match) {
    return {
      grado: normalizeGradoMatricula(match[1]),
      nivel: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase(),
    };
  }
  return { grado: normalizeGradoMatricula(t), nivel: '' };
}

export function defaultAforoForNivel(nivel: string): number {
  if (nivel === 'Inicial') return 25;
  if (nivel === 'Secundaria') return 35;
  return 30;
}
