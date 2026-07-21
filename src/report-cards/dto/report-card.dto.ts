import {
  IsArray,
  IsBoolean,
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
import type { ReportCardEstado } from '../entities/report-card.entity';

export class ReportCardQueryDto {
  @IsString()
  @MaxLength(40)
  nivel: string;

  @IsString()
  @MaxLength(20)
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
  @IsString()
  @MaxLength(20)
  estado?: ReportCardEstado | 'todos';
}

export class GenerateReportCardsDto extends ReportCardQueryDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  studentIds?: number[];
}

export class UpdateReportCardDto {
  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firmaDirectorNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firmaDirectorCargo?: string;

  @IsOptional()
  @IsBoolean()
  firmaDirectorFirmado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  firmaDirectorFecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firmaTutorNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firmaTutorCargo?: string;

  @IsOptional()
  @IsBoolean()
  firmaTutorFirmado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  firmaTutorFecha?: string;

  @IsOptional()
  @IsIn(['pendiente', 'generada', 'firmada'])
  estado?: ReportCardEstado;
}

export class UpdateReportCardBodyDto extends UpdateReportCardDto {
  @IsString()
  @MaxLength(40)
  nivel: string;

  @IsString()
  @MaxLength(20)
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
}
