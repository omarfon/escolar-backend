import { ChargeEstado } from '../entities/student-charge.entity';

export interface StaffChargeItemDto {
  id: number;
  studentId: number;
  alumno: string;
  codigoAlumno: string;
  grado: string;
  seccion: string;
  nivel: string;
  concepto: string;
  codigoConcepto: string;
  periodoLabel: string;
  monto: number;
  montoPagado: number;
  saldo: number;
  fechaVencimiento: string;
  estado: ChargeEstado;
  anioEscolar: number;
}

export interface TreasurySummaryDto {
  anioEscolar: number;
  recaudado: number;
  pendiente: number;
  vencido: number;
  recaudadoMes: number;
  totalCargos: number;
  cargosPendientes: number;
}
