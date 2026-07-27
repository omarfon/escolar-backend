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
const TIPOS_DOCUMENTO = ['DNI', 'CE', 'Pasaporte', 'PTP', 'Otro'] as const;
const PARENTESCOS = ['padre', 'madre', 'abuelo', 'tio', 'hermano', 'otro'] as const;

export class BulkMatriculaRowDto {
  @IsOptional()
  @IsInt()
  fila?: number;

  @IsString()
  @MaxLength(80)
  nombres: string;

  /** Legacy: columna única; preferir apellidoPaterno + apellidoMaterno */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidoMaterno?: string;

  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento?: (typeof TIPOS_DOCUMENTO)[number];

  @IsString()
  @MinLength(4)
  @MaxLength(20)
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

  @IsString()
  @MaxLength(200)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  distrito?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  departamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoEmergencia?: string;

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
  @MaxLength(80)
  apoderadoApellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apoderadoApellidoMaterno?: string;

  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO)
  apoderadoTipoDocumento?: (typeof TIPOS_DOCUMENTO)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  apoderadoDni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  apoderadoTelefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apoderadoEmail?: string;

  @IsOptional()
  @IsIn(PARENTESCOS)
  apoderadoParentesco?: (typeof PARENTESCOS)[number];
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
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  tipoDocumento?: (typeof TIPOS_DOCUMENTO)[number];
  dni: string;
  email: string;
  sexo?: 'M' | 'F';
  fechaNac?: string;
  direccion: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  telefonoEmergencia?: string;
  nivel: (typeof NIVELES)[number];
  grado: string;
  seccion: string;
  anioIngreso?: string;
  apoderadoNombres?: string;
  apoderadoApellidos?: string;
  apoderadoApellidoPaterno?: string;
  apoderadoApellidoMaterno?: string;
  apoderadoTipoDocumento?: (typeof TIPOS_DOCUMENTO)[number];
  apoderadoDni?: string;
  apoderadoTelefono?: string;
  apoderadoEmail?: string;
  apoderadoParentesco?: (typeof PARENTESCOS)[number];
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
