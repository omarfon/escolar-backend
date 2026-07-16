import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ContinuitySituacion } from '../entities/continuity-enrollment.entity';

export class GenerateContinuityItemDto {
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsIn(['promovido', 'repitente', 'retirado', 'egresado'])
  situacion?: ContinuitySituacion;

  @IsOptional()
  @IsString()
  seccionNueva?: string;
}

export class GenerateContinuityDto {
  @IsInt()
  @Min(2000)
  anioOrigen: number;

  @IsInt()
  @Min(2000)
  anioNuevo: number;

  @IsOptional()
  @IsString()
  generadoPor?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateContinuityItemDto)
  items: GenerateContinuityItemDto[];
}

export class ApproveContinuityDto {
  @IsOptional()
  @IsString()
  aprobadoPor?: string;
}

export class RejectContinuityDto {
  @IsString()
  motivoRechazo: string;
}

export class ApproveAllContinuityDto {
  @IsInt()
  anioNuevo: number;

  @IsOptional()
  @IsString()
  aprobadoPor?: string;
}
