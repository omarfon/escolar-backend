export type NivelRiesgoAusentismo = 'normal' | 'alerta' | 'critico';

export type RecurrentAlertPeriodoTipo = 'mes' | 'bimestre' | 'rolling30';

export interface RecurrentAlertRuleConfig {
  diasAlertaAusentismo: number;
  diasAlertaCritica: number;
  porcentajeUmbral: number;
  periodoTipo: RecurrentAlertPeriodoTipo;
  nivelEducativo: string;
  modalidad: string;
}

export interface AbsenceStatsInput {
  faltasInjustificadas: number;
  diasConsecutivos: number;
  totalRegistrosBd: number;
}

export interface AbsenceEvaluation {
  nivel: NivelRiesgoAusentismo;
  motivo: string;
  dispara: boolean;
  porcentajeInasistencia: number;
}

export const RECURRENT_ALERT_ESTADOS_ABIERTOS = [
  'abierta',
  'atendida',
  'derivada',
] as const;

export function calcPorcentajeInasistencia(
  faltasInjustificadas: number,
  totalRegistros: number,
): number {
  if (totalRegistros <= 0) return 0;
  return Math.round((faltasInjustificadas / totalRegistros) * 10000) / 100;
}

export function evaluateRecurrentAbsenteeism(
  stats: AbsenceStatsInput,
  config: RecurrentAlertRuleConfig,
): AbsenceEvaluation {
  const porcentaje = calcPorcentajeInasistencia(
    stats.faltasInjustificadas,
    stats.totalRegistrosBd,
  );

  const superaCritico =
    stats.faltasInjustificadas > config.diasAlertaCritica ||
    stats.diasConsecutivos > config.diasAlertaCritica ||
    porcentaje >= config.porcentajeUmbral * 1.5;

  const superaAlerta =
    stats.faltasInjustificadas > config.diasAlertaAusentismo ||
    stats.diasConsecutivos > config.diasAlertaAusentismo ||
    porcentaje >= config.porcentajeUmbral;

  const motivos: string[] = [];
  if (stats.faltasInjustificadas > config.diasAlertaAusentismo) {
    motivos.push(`${stats.faltasInjustificadas} faltas injustificadas registradas`);
  }
  if (stats.diasConsecutivos > config.diasAlertaAusentismo) {
    motivos.push(`${stats.diasConsecutivos} días consecutivos con falta`);
  }
  if (porcentaje >= config.porcentajeUmbral) {
    motivos.push(`${porcentaje}% de inasistencia sobre registros del periodo`);
  }

  if (superaCritico) {
    return {
      nivel: 'critico',
      motivo: motivos.join(' · ') || 'Umbral crítico de ausentismo recurrente',
      dispara: stats.faltasInjustificadas > 0,
      porcentajeInasistencia: porcentaje,
    };
  }

  if (superaAlerta) {
    return {
      nivel: 'alerta',
      motivo: motivos.join(' · ') || 'Umbral de alerta de ausentismo recurrente',
      dispara: stats.faltasInjustificadas > 0,
      porcentajeInasistencia: porcentaje,
    };
  }

  return {
    nivel: 'normal',
    motivo:
      stats.faltasInjustificadas > 0
        ? `${stats.faltasInjustificadas} falta(s) injustificada(s) bajo umbral configurado`
        : 'Sin inasistencias injustificadas en el periodo',
    dispara: false,
    porcentajeInasistencia: porcentaje,
  };
}

export function matchesNivelFilter(
  studentNivel: string,
  configNivel: string,
): boolean {
  const filter = configNivel.trim();
  if (!filter) return true;
  return studentNivel.trim().toLowerCase() === filter.toLowerCase();
}

export function matchesModalidadFilter(
  _studentModalidad: string | undefined,
  configModalidad: string,
): boolean {
  const filter = configModalidad.trim().toLowerCase();
  if (!filter || filter === 'todos') return true;
  return true;
}
