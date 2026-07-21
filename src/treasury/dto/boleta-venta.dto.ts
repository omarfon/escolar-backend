export interface BoletaInstitucionDto {
  nombre: string;
  siglas: string;
  ruc: string;
  codigoModular: string;
  direccion: string;
}

export interface BoletaEstudianteDto {
  id: number;
  nombreCompleto: string;
  nivel: string;
  grado: string;
  seccion: string;
}

export interface BoletaVentaDto {
  id: number;
  numeroBoleta: string;
  serie: string;
  correlativo: string;
  fechaEmision: string;
  fechaPago: string;
  estudiante: BoletaEstudianteDto;
  apoderado: string;
  concepto: string;
  periodoLabel: string;
  anioEscolar: number;
  monto: number;
  metodoPago: string;
  referencia: string;
  tarjetaMarca: string;
  tarjetaUltimos4: string;
  institucion: BoletaInstitucionDto;
}

export interface PayVisaResultDto {
  paymentId: number;
  numeroBoleta: string;
  monto: number;
  chargeId: number;
  estado: string;
  saldoRestante: number;
}
