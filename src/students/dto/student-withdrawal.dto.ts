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
  MOTIVOS_RETIRO,
  RETIRO_SUSTENTO_MAX,
  RETIRO_SUSTENTO_MIN,
} from '../student-withdrawal.constants';

export class CreateStudentWithdrawalDto {
  @IsDateString()
  fechaRetiro: string;

  @IsString()
  @IsIn([...MOTIVOS_RETIRO])
  motivo: string;

  @IsString()
  @MinLength(RETIRO_SUSTENTO_MIN)
  @MaxLength(RETIRO_SUSTENTO_MAX)
  sustento: string;
}

export class StudentWithdrawalFiltersDto {
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

export interface StudentWithdrawalContext {
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

export interface StudentWithdrawalEligibility {
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
  retiroExistenteId: number | null;
}

export interface StudentWithdrawalResponse {
  id: number;
  studentId: number;
  studentCodigo: string;
  studentNombre: string;
  anioEscolar: number;
  nivel: string;
  grado: string;
  seccion: string;
  fechaRetiro: string;
  motivo: string;
  sustento: string;
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

export interface StudentWithdrawalListResponse {
  items: StudentWithdrawalResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
