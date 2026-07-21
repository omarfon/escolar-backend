import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NivelLogro } from '../entities/competency-evaluation.entity';

export class SaveCompetencyEvaluationEntryDto {
  @IsInt()
  studentId: number;

  @IsInt()
  competenciaId: number;

  @IsOptional()
  @IsInt()
  evaluationId?: number;

  @IsOptional()
  @IsIn(['AD', 'A', 'B', 'C'])
  nivelLogro?: NivelLogro | null;
}

export class SaveCompetencyEvaluationsBulkDto {
  @IsString()
  @MaxLength(40)
  nivel: string;

  @IsString()
  @MaxLength(10)
  grado: string;

  @IsString()
  @MaxLength(10)
  seccion: string;

  @IsInt()
  @Min(1)
  @Max(4)
  bimestre: number;

  @IsOptional()
  @IsInt()
  anio?: number;

  @IsOptional()
  @IsInt()
  curriculumId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCompetencyEvaluationEntryDto)
  entries: SaveCompetencyEvaluationEntryDto[];
}
