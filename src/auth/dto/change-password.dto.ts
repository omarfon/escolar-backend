import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @MaxLength(100)
  passwordActual: string;

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
