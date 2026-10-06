import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CANALES_RETROALIMENTACION,
  RETROALIMENTACION_DESTINATARIO_MAX,
  RETROALIMENTACION_MENSAJE_MAX,
  RETROALIMENTACION_MENSAJE_MIN,
} from '../enrollment-feedback.constants';

export class CreateEnrollmentFeedbackDto {
  @Type(() => Number)
  @IsInt()
  enrollmentEvaluationId: number;

  @IsString()
  @IsIn([...CANALES_RETROALIMENTACION])
  canal: string;

  @IsDateString()
  fechaRetroalimentacion: string;

  @IsString()
  @MinLength(2)
  @MaxLength(RETROALIMENTACION_DESTINATARIO_MAX)
  destinatario: string;

  @IsString()
  @MinLength(RETROALIMENTACION_MENSAJE_MIN)
  @MaxLength(RETROALIMENTACION_MENSAJE_MAX)
  mensaje: string;

  @IsOptional()
  @IsBoolean()
  acuseRecibo?: boolean;
}

export interface EnrollmentFeedbackContext {
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
  canales: readonly string[];
  fechaMin: string;
  fechaMax: string;
}

export interface EnrollmentFeedbackEligibility {
  enrollmentEvaluationId: number;
  candidatoNombre: string;
  candidatoDni: string;
  tipoEvaluacion: string;
  resultadoEvaluacion: string;
  anioEscolar: number;
  elegible: boolean;
  motivoInelegible: string | null;
  fechaMin: string;
  fechaMax: string;
  retroalimentacionExistenteId: number | null;
}

export interface EnrollmentFeedbackResponse {
  id: number;
  anioEscolar: number;
  enrollmentEvaluationId: number;
  waitlistEntryId: number | null;
  studentId: number | null;
  candidatoNombre: string;
  candidatoDni: string;
  tipoEvaluacion: string;
  resultadoEvaluacion: string;
  canal: string;
  fechaRetroalimentacion: string;
  destinatario: string;
  mensaje: string;
  acuseRecibo: boolean;
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

export interface EnrollmentFeedbackListResponse {
  items: EnrollmentFeedbackResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
