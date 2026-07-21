import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterPaymentDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsString()
  @IsIn(['efectivo', 'transferencia', 'deposito'])
  metodoPago: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referencia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaPago debe tener formato YYYY-MM-DD',
  })
  fechaPago?: string;
}
