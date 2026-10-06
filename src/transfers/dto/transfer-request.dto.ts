import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ACCIONES_TRASLADO } from '../transfer.constants';
import type { AccionTraslado } from '../transfer.constants';
import { EVIDENCIA_TIPOS_TRASLADO } from '../transfer-evidencia.constants';
import type { EvidenciaTrasladoTipo } from '../transfer-evidencia.constants';

export class CreateTransferRequestDto {
  @Type(() => Number)
  @IsInt()
  studentId: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  ieDestinoNombre: string;

  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'El código modular de destino debe tener 6 a 8 dígitos' })
  ieDestinoCodigoModular: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ieDestinoUgel: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ieDestinoDre: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  @IsDateString()
  plazoHasta: string;

  @IsIn(EVIDENCIA_TIPOS_TRASLADO)
  evidenciaTipo: EvidenciaTrasladoTipo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  evidenciaDocumentId?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  evidenciaReferencia?: string;

  /** @deprecated Use evidenciaTipo + documento o referencia. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class UpdateTransferRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  ieDestinoNombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'El código modular de destino debe tener 6 a 8 dígitos' })
  ieDestinoCodigoModular?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ieDestinoUgel?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ieDestinoDre?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  @IsOptional()
  @IsDateString()
  plazoHasta?: string;

  @IsOptional()
  @IsIn(EVIDENCIA_TIPOS_TRASLADO)
  evidenciaTipo?: EvidenciaTrasladoTipo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  evidenciaDocumentId?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  evidenciaReferencia?: string;

  /** @deprecated Use evidenciaTipo + documento o referencia. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidencia?: string;
}

export class TransitionTransferRequestDto {
  @IsIn(ACCIONES_TRASLADO)
  accion: AccionTraslado;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  /** Sección en la IE destino; obligatoria si hay más de una sección con vacantes. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  seccionDestino?: string;
}

export class RegisterTransferMotivoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
