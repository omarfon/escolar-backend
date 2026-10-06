import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(120)
  email: string;
}

export class ForgotPasswordResponseDto {
  message: string;
  accepted: boolean;
}
