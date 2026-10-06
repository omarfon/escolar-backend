import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export interface StudentChangeLogResponse {
  id: number;
  studentId: number;
  studentCodigo: string;
  studentNombre: string;
  accion: string;
  actorUserId: number | null;
  actorNombre: string;
  actorRol: string;
  motivo: string;
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
  ip: string;
  correlationId: string | null;
  resultado: string;
  createdAt: string;
  fechaDisplay: string;
  horaDisplay: string;
}

export interface StudentChangeAuditContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
  permisoExportacion: string;
}

export class StudentChangeAuditFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  studentId?: number;

  @IsOptional()
  @IsString()
  accion?: string;

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

export interface StudentAuditContext {
  req?: import('express').Request;
  motivo?: string;
}
