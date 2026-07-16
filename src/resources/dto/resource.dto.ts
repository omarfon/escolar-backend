import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn(['tarea', 'clase', 'lectura', 'video', 'enlace', 'evaluacion'])
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
  @IsBoolean()
  visible?: boolean;
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
  @IsIn(['tarea', 'clase', 'lectura', 'video', 'enlace', 'evaluacion'])
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
  @IsBoolean()
  visible?: boolean;
}
