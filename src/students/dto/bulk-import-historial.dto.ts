import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkHistorialRowDto {
  @IsOptional()
  @IsNumber()
  fila?: number;

  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsString()
  @IsNotEmpty()
  anio: string;

  @IsString()
  @IsNotEmpty()
  grado: string;

  @IsString()
  @IsNotEmpty()
  seccion: string;

  @IsNumber()
  @Min(0)
  @Max(20)
  promedio: number;

  @IsOptional()
  @IsString()
  estado?: string;
}

export class BulkImportHistorialDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkHistorialRowDto)
  filas: BulkHistorialRowDto[];
}

export interface BulkHistorialErrorItem {
  fila: number;
  dni: string;
  email: string;
  mensaje: string;
}

export interface HistorialRegistroAnterior {
  grado: string;
  seccion: string;
  promedio: number;
  estado: string;
}

export interface BulkHistorialPreviewItem {
  fila: number;
  nombres: string;
  apellidos: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  codigo: string;
  email: string;
  nivel: string;
  anio: string;
  grado: string;
  seccion: string;
  promedio: number;
  estado: string;
  yaRegistrado: boolean;
  accionPrevista: 'creado' | 'actualizado' | 'sin_cambios';
  registroAnterior?: HistorialRegistroAnterior;
  motivo?: string;
}

export interface BulkHistorialPreviewResult {
  total: number;
  listosCount: number;
  bloqueadosCount: number;
  nuevosCount: number;
  actualizadosCount: number;
  sinCambiosCount: number;
  listos: BulkHistorialPreviewItem[];
  bloqueados: BulkHistorialPreviewItem[];
}

export interface BulkImportHistorialResult {
  total: number;
  importados: number;
  actualizados: number;
  creados: number;
  sinCambios: number;
  omitidos: number;
  errores: BulkHistorialErrorItem[];
  erroresValidacion: BulkHistorialErrorItem[];
  filas: Array<{
    studentId: number;
    codigo: string;
    nombres: string;
    apellidos: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    dni: string;
    email: string;
    nivel: string;
    anio: string;
    grado: string;
    seccion: string;
    promedio: number;
    estado: string;
    accion: 'creado' | 'actualizado' | 'sin_cambios';
  }>;
}
