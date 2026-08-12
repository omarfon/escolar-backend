import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos que el docente puede actualizar desde su portal. */
export class UpdateMiPerfilDocenteDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;
}
