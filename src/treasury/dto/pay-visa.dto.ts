import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class PayVisaDto {
  @IsString()
  @Matches(/^\d{16}$/, { message: 'El número de tarjeta debe tener 16 dígitos' })
  numeroTarjeta: string;

  @IsString()
  @MaxLength(80)
  nombreTitular: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, {
    message: 'Vencimiento inválido (use MM/YY)',
  })
  vencimiento: string;

  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'CVV inválido' })
  cvv: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;
}
