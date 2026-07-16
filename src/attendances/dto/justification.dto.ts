import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJustificationDto {
  @IsInt()
  studentId: number;

  @IsInt()
  @Min(1)
  @Max(30)
  cantidad: number;

  @IsString()
  @MinLength(2)
  motivo: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsString()
  registradoPor?: string;
}
