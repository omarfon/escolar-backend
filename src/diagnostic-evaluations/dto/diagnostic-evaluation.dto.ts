import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NIVELES_LOGRO_DIAGNOSTICO } from '../diagnostic-evaluations.constants';

export class DiagnosticEvaluationEntryDto {
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsInt()
  evaluationId?: number;

  @ValidateIf((o: DiagnosticEvaluationEntryDto) => o.nota !== undefined)
  @IsNumber()
  @Min(0)
  @Max(20)
  nota?: number;

  @ValidateIf((o: DiagnosticEvaluationEntryDto) => o.nivelLogro !== undefined)
  @IsIn([...NIVELES_LOGRO_DIAGNOSTICO])
  nivelLogro?: (typeof NIVELES_LOGRO_DIAGNOSTICO)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class SaveDiagnosticEvaluationsBulkDto {
  @IsString()
  nivel: string;

  @IsString()
  grado: string;

  @IsString()
  seccion: string;

  @IsString()
  curso: string;

  @IsDateString()
  fechaEvaluacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  auditMotivo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiagnosticEvaluationEntryDto)
  entries: DiagnosticEvaluationEntryDto[];
}
