/** Grados ingresantes: cupo total del salon (nueva matricula externa). */
export function isIngresanteGrade(nivel: string, grado: string): boolean {
  const g = normalizeGradoMatricula(grado);
  return (
    (nivel === 'Primaria' && g === '1°') ||
    (nivel === 'Secundaria' && g === '1°')
  );
}

export function normalizeGradoMatricula(grado: string): string {
  let t = grado.trim();
  const withNivel = t.match(/^(.+?)\s+(Inicial|Primaria|Secundaria)$/i);
  if (withNivel) {
    t = withNivel[1].trim();
  }
  if (/^\d+\s*°?$/.test(t)) {
    const n = t.replace(/[^\d]/g, '');
    return `${n}°`;
  }
  const num = t.match(/^(\d+)/);
  if (num) return `${num[1]}°`;
  return t;
}

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
