import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ESTADOS_ANIO_ESCOLAR,
  TIPOS_PERIODO_ANIO_ESCOLAR,
} from '../anio-escolar.constants';

export class CreateAnioEscolarDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio: number;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  fechaInicio: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  fechaFin: string;

  @IsIn(TIPOS_PERIODO_ANIO_ESCOLAR)
  tipoPeriodo: (typeof TIPOS_PERIODO_ANIO_ESCOLAR)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  generarPeriodos?: boolean;

  @IsOptional()
  @IsBoolean()
  activar?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class ActivarAnioEscolarDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  generarPeriodos?: boolean;
}

export class CerrarAnioEscolarDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo: string;
}

export class CopiarCalendarioAnioEscolarDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anioOrigen?: number;

  @IsOptional()
  @IsBoolean()
  copiarPeriodos?: boolean = true;

  @IsOptional()
  @IsBoolean()
  copiarFeriados?: boolean = true;

  @IsOptional()
  @IsBoolean()
  copiarEventos?: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class DividirPeriodosPorAnioIdDto {
  @IsOptional()
  @IsIn(TIPOS_PERIODO_ANIO_ESCOLAR)
  tipo?: (typeof TIPOS_PERIODO_ANIO_ESCOLAR)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  sobreescribir?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class PublicarComunicadoCalendarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  cuerpo?: string;

  @IsOptional()
  @IsIn(['alumnos', 'padres', 'todos', 'docentes'])
  destinatarios?: 'alumnos' | 'padres' | 'todos' | 'docentes';

  @IsOptional()
  @IsIn(['alta', 'media', 'baja'])
  prioridad?: 'alta' | 'media' | 'baja';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fechaPublicacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  republicar?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class ListAniosEscolaresQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(ESTADOS_ANIO_ESCOLAR)
  estado?: (typeof ESTADOS_ANIO_ESCOLAR)[number];
}
