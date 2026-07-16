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
} from 'class-validator';

export class CreateGradeDto {
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsInt()
  courseId?: number;

  @IsString()
  @MaxLength(120)
  curso: string;

  @IsIn(['daily', 'partial', 'final'])
  tipo: 'daily' | 'partial' | 'final';

  @IsInt()
  @Min(1)
  @Max(4)
  bimestre: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  nota: number;

  @IsDateString()
  fechaEvaluacion: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
