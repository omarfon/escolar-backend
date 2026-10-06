import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  EVALUACION_OBSERVACIONES_MAX,
  EVALUACION_PUNTAJE_MAX,
  EVALUACION_PUNTAJE_MIN,
  EVALUACION_RESOLUCION_MAX,
  EVALUACION_RESOLUCION_MIN,
  RESULTADOS_EVALUACION_MATRICULA,
  TIPOS_EVALUACION_MATRICULA,
} from '../enrollment-evaluation.constants';

export class CreateEnrollmentEvaluationDto {
  @ValidateIf((dto: CreateEnrollmentEvaluationDto) => !dto.studentId)
  @IsInt()
  @Type(() => Number)
  waitlistEntryId?: number;

  @ValidateIf((dto: CreateEnrollmentEvaluationDto) => !dto.waitlistEntryId)
  @IsInt()
  @Type(() => Number)
  studentId?: number;

  @IsString()
  @IsIn([...TIPOS_EVALUACION_MATRICULA])
  tipoEvaluacion: string;

  @IsDateString()
  fechaEvaluacion: string;

  @IsString()
  @IsIn([...RESULTADOS_EVALUACION_MATRICULA])
  resultado: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(EVALUACION_PUNTAJE_MIN)
  @Max(EVALUACION_PUNTAJE_MAX)
  puntaje?: number;

  @IsOptional()
  @IsString()
  @MaxLength(EVALUACION_OBSERVACIONES_MAX)
  observaciones?: string;

  @IsString()
  @MinLength(EVALUACION_RESOLUCION_MIN)
  @MaxLength(EVALUACION_RESOLUCION_MAX)
  resolucion: string;
}

export interface EnrollmentEvaluationContext {
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
  tiposEvaluacion: readonly string[];
  resultados: readonly string[];
  resultadoLabels: Record<string, string>;
  fechaMin: string;
  fechaMax: string;
}

export interface EnrollmentEvaluationEligibility {
  origen: 'waitlist' | 'estudiante';
  waitlistEntryId: number | null;
  studentId: number | null;
  candidatoNombre: string;
  candidatoDni: string;
  nivel: string;
  grado: string;
  seccionDeseada: string;
  anioEscolar: number;
  elegible: boolean;
  motivoInelegible: string | null;
  fechaMin: string;
  fechaMax: string;
  tiposRegistrados: string[];
  tiposDisponibles: string[];
}

export interface EnrollmentEvaluationResponse {
  id: number;
  anioEscolar: number;
  origen: 'waitlist' | 'estudiante';
  waitlistEntryId: number | null;
  studentId: number | null;
  candidatoNombre: string;
  candidatoDni: string;
  nivel: string;
  grado: string;
  seccionDeseada: string;
  tipoEvaluacion: string;
  fechaEvaluacion: string;
  resultado: string;
  puntaje: number | null;
  observaciones: string;
  resolucion: string;
  estado: string;
  actorUserId: number | null;
  actorNombre: string;
  actorRol: string;
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
  ip: string;
  correlationId: string | null;
  createdAt: string;
  duplicadoIdempotente?: boolean;
}

export interface EnrollmentEvaluationListResponse {
  items: EnrollmentEvaluationResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
