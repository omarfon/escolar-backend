import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MOTIVOS_REINGRESO,
  REINGRESO_AUTORIZACION_MAX,
  REINGRESO_AUTORIZACION_MIN,
} from '../student-readmission.constants';

export class CreateStudentReadmissionDto {
  @IsDateString()
  fechaReingreso: string;

  @IsString()
  @IsIn([...MOTIVOS_REINGRESO])
  motivo: string;

  @IsString()
  @MinLength(REINGRESO_AUTORIZACION_MIN)
  @MaxLength(REINGRESO_AUTORIZACION_MAX)
  autorizacion: string;
}

export class StudentReadmissionFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  studentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anioEscolar?: number;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

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

export interface StudentReadmissionContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel: string;
    dre: string;
    codigoModular: string;
  };
  permisoRegistrar: string;
  permisoConsultar: string;
  motivos: readonly string[];
  fechaMin: string;
  fechaMax: string;
}

export interface StudentReadmissionEligibility {
  studentId: number;
  studentCodigo: string;
  studentNombre: string;
  nivel: string;
  grado: string;
  seccion: string;
  estadoMatricula: string;
  anioEscolar: number;
  elegible: boolean;
  motivoInelegible: string | null;
  fechaMin: string;
  fechaMax: string;
  withdrawalId: number | null;
  fechaRetiro: string | null;
  vacantesDisponibles: number;
  reingresoExistenteId: number | null;
}

export interface StudentReadmissionResponse {
  id: number;
  studentId: number;
  studentCodigo: string;
  studentNombre: string;
  anioEscolar: number;
  withdrawalId: number;
  nivel: string;
  grado: string;
  seccion: string;
  fechaReingreso: string;
  fechaRetiroVinculada: string;
  motivo: string;
  autorizacion: string;
  estado: string;
  actorUserId: number | null;
  actorNombre: string;
  actorRol: string;
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
  ip: string;
  correlationId: string | null;
  notasConservadas: number;
  asistenciasConservadas: number;
  vacantesDisponiblesDespues: number;
  createdAt: string;
  duplicadoIdempotente?: boolean;
}

export interface StudentReadmissionListResponse {
  items: StudentReadmissionResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
