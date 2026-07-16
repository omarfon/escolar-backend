import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCampusDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(20) codigo?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) distrito?: string;
  @IsOptional() @IsString() @MaxLength(80) provincia?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) director?: string;
  @IsOptional() @IsArray() niveles?: string[];
  @IsOptional() @IsArray() turnos?: string[];
  @IsOptional() @IsIn(['activo', 'inactivo']) estado?: 'activo' | 'inactivo';
}
