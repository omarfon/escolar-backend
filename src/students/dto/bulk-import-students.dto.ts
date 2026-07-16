import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ExpedienteResponse } from '../students.mapper';

const NIVELES = ['Inicial', 'Primaria', 'Secundaria'] as const;
const SEXOS = ['M', 'F'] as const;

export class BulkMatriculaRowDto {
  @IsOptional()
  @IsInt()
  fila?: number;

  @IsString()
  @MaxLength(80)
  nombres: string;

  @IsString()
  @MaxLength(80)
  apellidos: string;

  @IsString()
  @MinLength(8)
  @MaxLength(8)
  dni: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsIn(SEXOS)
  sexo?: 'M' | 'F';

  @IsOptional()
  @IsString()
  fechaNac?: string;

  @IsIn(NIVELES)
  nivel: (typeof NIVELES)[number];

  @IsString()
  @MaxLength(10)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  anioIngreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apoderadoNombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apoderadoApellidos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  apoderadoDni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  apoderadoTelefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apoderadoEmail?: string;
}

export class BulkImportMatriculaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkMatriculaRowDto)
  estudiantes: BulkMatriculaRowDto[];
}

export interface BulkMatriculaError {
  fila: number;
  dni: string;
  email: string;
  mensaje: string;
}

export interface BulkImportMatriculaResult {
  total: number;
  creados: number;
  omitidos: number;
  errores: BulkMatriculaError[];
  erroresValidacion: BulkMatriculaError[];
  estudiantes: ExpedienteResponse[];
}

export interface BulkMatriculaPreviewItem {
  fila: number;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  sexo?: 'M' | 'F';
  fechaNac?: string;
  nivel: (typeof NIVELES)[number];
  grado: string;
  seccion: string;
  anioIngreso?: string;
  apoderadoNombres?: string;
  apoderadoApellidos?: string;
  apoderadoDni?: string;
  apoderadoTelefono?: string;
  apoderadoEmail?: string;
  gradoLabel: string;
  motivo?: string;
}

export interface BulkMatriculaPreviewResult {
  total: number;
  listosCount: number;
  bloqueadosCount: number;
  listos: BulkMatriculaPreviewItem[];
  bloqueados: BulkMatriculaPreviewItem[];
}
