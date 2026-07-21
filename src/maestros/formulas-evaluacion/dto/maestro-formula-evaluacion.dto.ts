import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import {
  FormulaComponente,
  FormulaEscalaLogro,
} from '../entities/maestro-formula-evaluacion.entity';

export class FormulaComponenteDto implements FormulaComponente {
  @IsString()
  @MaxLength(40)
  codigo: string;

  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  peso: number;

  @IsInt()
  @Min(1)
  orden: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class FormulaEscalaLogroDto implements FormulaEscalaLogro {
  @IsNumber()
  AD: number;

  @IsNumber()
  A: number;

  @IsNumber()
  B: number;
}

export class CreateMaestroFormulaEvaluacionDto {
  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

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
  @MaxLength(120)
  curso?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  bimestre?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormulaComponenteDto)
  componentes: FormulaComponenteDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FormulaEscalaLogroDto)
  escalaLogro?: FormulaEscalaLogroDto;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsIn(['activo', 'inactivo'])
  estado?: 'activo' | 'inactivo';
}

export class UpdateMaestroFormulaEvaluacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

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
  @MaxLength(120)
  curso?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  bimestre?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormulaComponenteDto)
  componentes?: FormulaComponenteDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FormulaEscalaLogroDto)
  escalaLogro?: FormulaEscalaLogroDto;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsIn(['activo', 'inactivo'])
  estado?: 'activo' | 'inactivo';
}
