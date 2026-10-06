import {
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveRegistryGradeEntryDto {
  @IsInt()
  studentId: number;

  @IsString()
  @MaxLength(40)
  componenteCodigo: string;

  @IsOptional()
  @IsInt()
  gradeId?: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  nota: number;
}

export class SaveGradeRegistryDto {
  @IsString()
  @MaxLength(120)
  curso: string;

  @IsInt()
  @Min(1)
  @Max(4)
  bimestre: number;

  @IsDateString()
  fechaEvaluacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nivel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  seccion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveRegistryGradeEntryDto)
  entries: SaveRegistryGradeEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  auditMotivo?: string;
}
