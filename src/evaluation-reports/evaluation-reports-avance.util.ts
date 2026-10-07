export interface AvanceAlumnoComponentes {
  componentesRegistrados: number;
}

export function computeNotasAvanceMetrics(
  alumnos: AvanceAlumnoComponentes[],
  componentesPorAlumno: number,
): {
  componentesEsperados: number;
  componentesRegistrados: number;
  avancePct: number | null;
  alumnosCompletos: number;
  alumnosPendientes: number;
} {
  const alumnosCount = alumnos.length;
  const componentesEsperados = alumnosCount * componentesPorAlumno;
  let componentesRegistrados = 0;
  let alumnosCompletos = 0;

  for (const alumno of alumnos) {
    componentesRegistrados += alumno.componentesRegistrados;
    if (
      componentesPorAlumno > 0 &&
      alumno.componentesRegistrados >= componentesPorAlumno
    ) {
      alumnosCompletos++;
    }
  }

  return {
    componentesEsperados,
    componentesRegistrados,
    avancePct:
      componentesEsperados > 0
        ? Math.round((componentesRegistrados / componentesEsperados) * 1000) /
          10
        : null,
    alumnosCompletos,
    alumnosPendientes: alumnosCount - alumnosCompletos,
  };
}

export function computeGlobalAvancePct(
  registrados: number,
  esperados: number,
): number | null {
  if (esperados <= 0) return null;
  return Math.round((registrados / esperados) * 1000) / 10;
}
