import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const CONCEPT_TIPOS = ['obligatorio', 'voluntario', 'eventual'] as const;
const CONCEPT_PERIODICIDADES = ['mensual', 'bimestral', 'anual', 'unico'] as const;

export type ConceptTipoDto = (typeof CONCEPT_TIPOS)[number];
export type ConceptPeriodicidadDto = (typeof CONCEPT_PERIODICIDADES)[number];

export class CreatePaymentConceptDto {
  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  monto: number;

  @IsIn(CONCEPT_TIPOS)
  tipo: ConceptTipoDto;

  @IsIn(CONCEPT_PERIODICIDADES)
  periodicidad: ConceptPeriodicidadDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nivel?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdatePaymentConceptDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  monto?: number;

  @IsOptional()
  @IsIn(CONCEPT_TIPOS)
  tipo?: ConceptTipoDto;

  @IsOptional()
  @IsIn(CONCEPT_PERIODICIDADES)
  periodicidad?: ConceptPeriodicidadDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nivel?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class TogglePaymentConceptActivoDto {
  @IsBoolean()
  activo: boolean;
}

export interface PaymentConceptResponseDto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  monto: number;
  tipo: ConceptTipoDto;
  periodicidad: ConceptPeriodicidadDto;
  nivel: string;
  activo: boolean;
  creadoEl: string;
}
