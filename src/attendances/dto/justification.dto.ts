import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

function toInt(value: unknown): number {
  return Number(value);
}

function toIntArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((v) => Number(v));
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((v) => Number(v));
  }
  return undefined;
}

export class CreateJustificationDto {
  @Transform(({ value }) => toInt(value))
  @IsInt()
  studentId: number;

  @Transform(({ value }) => toInt(value))
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

  @IsOptional()
  @IsString()
  mes?: string;

  @IsOptional()
  @Transform(({ value }) => toIntArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  attendanceIds?: number[];
}
