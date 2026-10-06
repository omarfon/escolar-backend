import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EscalaLogroDto } from '../../institution/dto/escala-logro.dto';

export class UpdateGradingScaleConfigDto {
  @IsOptional()
  @IsIn(['numerico', 'literal', 'mixto'])
  sistemaEval?: 'numerico' | 'literal' | 'mixto';

  @IsOptional()
  @IsIn(['bimestre', 'trimestre', 'semestre'])
  tipoPeriodo?: 'bimestre' | 'trimestre' | 'semestre';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  notaMinima?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => EscalaLogroDto)
  escalaLogro?: EscalaLogroDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class UpdateNivelEscalaDto {
  @IsIn(['numerica', 'literal', 'competencia'])
  tipoEscala!: 'numerica' | 'literal' | 'competencia';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class GradingScaleHistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
