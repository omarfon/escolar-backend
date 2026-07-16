import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn(['academico', 'deportivo', 'cultural', 'reunion', 'feriado', 'otro'])
  tipo: string;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsString()
  lugar?: string;

  @IsIn(['alumnos', 'padres', 'todos', 'docentes'])
  destinatarios: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  responsable?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsIn(['academico', 'deportivo', 'cultural', 'reunion', 'feriado', 'otro'])
  tipo?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsString()
  lugar?: string;

  @IsOptional()
  @IsIn(['alumnos', 'padres', 'todos', 'docentes'])
  destinatarios?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  responsable?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsBoolean()
  cancelado?: boolean;
}
