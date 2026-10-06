/** Fecha de corte normativa MINEDU: 31 de marzo del año escolar. */
export function fechaCorteNormativa(anioEscolar: number): string {
  return `${anioEscolar}-03-31`;
}

export function calcularEdadEnCorte(
  fechaNac: string,
  anioEscolar: number,
): number | null {
  const iso = fechaNac.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const nac = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(nac.getTime())) return null;
  const corte = new Date(`${fechaCorteNormativa(anioEscolar)}T12:00:00`);
  let edad = corte.getFullYear() - nac.getFullYear();
  const mes = corte.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && corte.getDate() < nac.getDate())) {
    edad -= 1;
  }
  return edad >= 0 ? edad : null;
}

export function parseGradoNumero(grado: string): number | null {
  const match = grado.trim().match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** Edad mínima normativa al 31/03 según nivel y grado. */
export function edadNormativaEsperada(
  nivel: string,
  grado: string,
): number | null {
  const num = parseGradoNumero(grado);
  if (num == null || num < 1) return null;
  const n = nivel.trim().toLowerCase();
  if (n === 'inicial') return num + 2;
  if (n === 'primaria') return num + 5;
  if (n === 'secundaria') return num + 11;
  return null;
}

export interface EdadNormativaResult {
  valido: boolean;
  edadActual: number | null;
  edadEsperada: number | null;
  fechaCorte: string;
  mensaje: string | null;
}

export function validarEdadNormativa(input: {
  fechaNac: string;
  nivel: string;
  grado: string;
  anioEscolar: number;
}): EdadNormativaResult {
  const fechaCorte = fechaCorteNormativa(input.anioEscolar);
  const edadActual = calcularEdadEnCorte(input.fechaNac, input.anioEscolar);
  const edadEsperada = edadNormativaEsperada(input.nivel, input.grado);

  if (edadActual == null) {
    return {
      valido: false,
      edadActual: null,
      edadEsperada,
      fechaCorte,
      mensaje: 'Fecha de nacimiento inválida.',
    };
  }

  if (edadEsperada == null) {
    return {
      valido: false,
      edadActual,
      edadEsperada: null,
      fechaCorte,
      mensaje: 'No se pudo determinar la edad normativa para el grado indicado.',
    };
  }

  if (edadActual !== edadEsperada) {
    return {
      valido: false,
      edadActual,
      edadEsperada,
      fechaCorte,
      mensaje: `La edad al ${fechaCorte} es ${edadActual} años; para ${input.grado} ${input.nivel} se requiere ${edadEsperada} años.`,
    };
  }

  return {
    valido: true,
    edadActual,
    edadEsperada,
    fechaCorte,
    mensaje: null,
  };
}
