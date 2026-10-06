import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ScanRecurrentAlertsDto {
  @IsOptional()
  @IsString()
  mes?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  grado?: string;
}

export class RecurrentAlertActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  derivadoAUsuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  derivadoARol?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  justificationId?: number;
}

export class UpdateRecurrentAlertSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  diasAlertaAusentismo?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
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

export class CloseRecurrentAlertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
