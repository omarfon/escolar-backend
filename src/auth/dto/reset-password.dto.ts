import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  @MaxLength(128)
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  passwordNuevo: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirme la contraseña' })
  @MaxLength(100)
  confirmPassword: string;
}

export class ResetPasswordResponseDto {
  message: string;
  success: boolean;
}
