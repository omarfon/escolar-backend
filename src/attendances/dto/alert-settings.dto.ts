import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  diasAlertaAusentismo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  diasAlertaCritica?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  porcentajeUmbral?: number;

  @IsOptional()
  @IsIn(['mes', 'bimestre', 'rolling30'])
  periodoTipo?: 'mes' | 'bimestre' | 'rolling30';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nivelEducativo?: string;

  @IsOptional()
  @IsIn(['todos', 'presencial', 'virtual'])
  modalidad?: string;
}
