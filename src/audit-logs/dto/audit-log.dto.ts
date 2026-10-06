import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAuditLogDto {
  @IsOptional()
  @IsInt()
  usuarioId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuarioNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  usuarioRol?: string;

  @IsOptional()
  @IsInt()
  institutionId?: number | null;

  @IsIn([
    'crear',
    'actualizar',
    'eliminar',
    'login',
    'logout',
    'exportar',
    'aprobar',
    'rechazar',
    'publicar',
    'configurar',
    'consultar',
  ])
  accion: string;

  @IsString()
  @MaxLength(60)
  modulo: string;

  @IsString()
  @MaxLength(80)
  entidad: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidadId?: string;

  @IsString()
  descripcion: string;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  nivel?: string;

  @IsOptional()
  @IsIn(['success', 'error'])
  resultado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;
}

export class AuditLogFiltersDto {
  @IsOptional()
  @IsString()
  modulo?: string;

  @IsOptional()
  @IsString()
  accion?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  usuario?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsIn(['accesos', 'todos'])
  tipo?: string;

  @IsOptional()
  @IsIn(['success', 'error'])
  resultado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
