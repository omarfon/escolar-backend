import { BadRequestException } from '@nestjs/common';
import { CalendarioQueryDto } from './dto/calendario.dto';

export interface CalendarioRango {
  desde: string;
  hasta: string;
  mes: string;
}

export function resolveCalendarioRango(query: CalendarioQueryDto): CalendarioRango {
  if (query.desde && query.hasta) {
    if (query.desde > query.hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    const mes = query.desde.slice(0, 7);
    return { desde: query.desde, hasta: query.hasta, mes };
  }

  const mes =
    query.mes ??
    (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();

  const [y, m] = mes.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new BadRequestException('mes inválido');
  }

  const lastDay = new Date(y, m, 0).getDate();
  return {
    mes,
    desde: `${mes}-01`,
    hasta: `${mes}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function fechaEnRango(fecha: string, desde: string, hasta: string): boolean {
  return fecha >= desde && fecha <= hasta;
}

export function eventoEnRango(
  fechaInicio: string,
  fechaFin: string | null | undefined,
  desde: string,
  hasta: string,
): boolean {
  const fin = fechaFin ?? fechaInicio;
  return fechaInicio <= hasta && fin >= desde;
}

export function esFinDeSemana(fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

export function assertRangoDentroAnioEscolar(
  desde: string,
  hasta: string,
  anioInicio: string,
  anioFin: string,
): void {
  if (desde < anioInicio || hasta > anioFin) {
    throw new BadRequestException(
      'El rango consultado debe estar dentro del año escolar seleccionado',
    );
  }
}
