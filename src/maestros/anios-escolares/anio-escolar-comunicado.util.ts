export interface ResumenCalendarioComunicado {
  institutionNombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  tipoPeriodo: string;
  version: number;
  periodos: Array<{ nombre: string; inicio: string; fin: string }>;
  feriados: number;
  eventos: number;
  cuerpoAdicional?: string;
}

export function construirComunicadoCalendario(
  input: ResumenCalendarioComunicado,
): { titulo: string; cuerpo: string } {
  const titulo = `Calendario escolar ${input.anio} — ${input.institutionNombre}`;
  const lineasPeriodos = input.periodos
    .map((p) => `• ${p.nombre}: ${p.inicio} al ${p.fin}`)
    .join('\n');

  const cuerpo = [
    `La institución educativa ${input.institutionNombre} publica el calendario escolar ${input.anio}.`,
    '',
    `Año lectivo: ${input.fechaInicio} al ${input.fechaFin}`,
    `Organización: ${input.tipoPeriodo}`,
    `Versión del calendario: v${input.version + 1}`,
    '',
    'Periodos académicos:',
    lineasPeriodos || '• Sin periodos registrados',
    '',
    `Feriados registrados: ${input.feriados}`,
    `Actividades y eventos: ${input.eventos}`,
    '',
    'Consulte el calendario completo en el portal institucional.',
    input.cuerpoAdicional?.trim() ? `\n${input.cuerpoAdicional.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { titulo, cuerpo };
}
