import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(120)
  titulo: string;

  @IsString()
  cuerpo: string;

  @IsIn(['general', 'academico', 'administrativo', 'urgente', 'evento'])
  tipo: 'general' | 'academico' | 'administrativo' | 'urgente' | 'evento';

  @IsIn(['alumnos', 'padres', 'todos', 'docentes'])
  destinatarios: 'alumnos' | 'padres' | 'todos' | 'docentes';

  @IsIn(['alta', 'media', 'baja'])
  prioridad: 'alta' | 'media' | 'baja';

  @IsDateString()
  fechaPublicacion: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;
}
