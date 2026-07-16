import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateActaDto {
  @IsString()
  @MinLength(2)
  nivel: string;

  @IsString()
  @MinLength(1)
  grado: string;

  @IsString()
  @MinLength(1)
  seccion: string;

  @IsInt()
  @Min(1)
  @Max(4)
  bimestre: number;

  @IsOptional()
  @IsString()
  anio?: string;

  @IsOptional()
  @IsString()
  docente?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ApproveActaDto {
  @IsOptional()
  @IsString()
  aprobadoPor?: string;
}
