import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsString()
  @MaxLength(80)
  apellido: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @MaxLength(20)
  nivel: string;

  @IsString()
  @MaxLength(20)
  grado: string;

  @IsString()
  @MaxLength(5)
  seccion: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
