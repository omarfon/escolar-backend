import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function toOptionalBoolean(value: unknown): unknown {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
}

export class CreateResourceDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn([
    'tarea',
    'clase',
    'lectura',
    'video',
    'enlace',
    'evaluacion',
    'imagen',
    'documento',
    'excel',
    'ppt',
  ])
  tipo: string;

  @IsOptional()
  @IsInt()
  courseId?: number;

  @IsString()
  curso: string;

  @IsString()
  nivel: string;

  @IsString()
  grado: string;

  @IsString()
  seccion: string;

  @IsOptional()
  @IsString()
  docente?: string;

  @IsDateString()
  fechaPublicacion: string;

  @IsOptional()
  @IsDateString()
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  nombreArchivo?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  tamanoBytes?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visible?: boolean;
}

export class UpdateResourceVisibilityDto {
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visible: boolean;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsIn([
    'tarea',
    'clase',
    'lectura',
    'video',
    'enlace',
    'evaluacion',
    'imagen',
    'documento',
    'excel',
    'ppt',
  ])
  tipo?: string;

  @IsOptional()
  @IsDateString()
  fechaPublicacion?: string;

  @IsOptional()
  @IsDateString()
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  nombreArchivo?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  tamanoBytes?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visible?: boolean;
}
