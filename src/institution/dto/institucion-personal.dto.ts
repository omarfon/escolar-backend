import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CambiarCredencialInstitucionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password: string;
}

export class EstadoUsuarioInstitucionDto {
  @IsIn(['activo', 'inactivo'])
  estado: 'activo' | 'inactivo';
}
