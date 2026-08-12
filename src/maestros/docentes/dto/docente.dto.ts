import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const ESTADOS = ['activo', 'inactivo', 'bloqueado'] as const;

export class CreateDocenteDto {
  @IsString() @MaxLength(80) nombres: string;
  @IsString() @MaxLength(80) apellidos: string;
  @IsString() @MinLength(8) @MaxLength(8) dni: string;
  @IsEmail() @MaxLength(120) email: string;
  @IsOptional() @IsString() @MaxLength(50) username?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) sede?: string;
  @IsOptional() @IsIn(ESTADOS) estado?: (typeof ESTADOS)[number];
  @IsString() @MaxLength(120) especialidad: string;
  @IsOptional() @IsIn(['nombrado', 'contratado']) tipo?: 'nombrado' | 'contratado';
  @IsString() @MinLength(8) @MaxLength(100) password: string;
}

export class UpdateDocenteDto {
  @IsOptional() @IsString() @MaxLength(80) nombres?: string;
  @IsOptional() @IsString() @MaxLength(80) apellidos?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(8) dni?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(50) username?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) sede?: string;
  @IsOptional() @IsIn(ESTADOS) estado?: (typeof ESTADOS)[number];
  @IsOptional() @IsString() @MaxLength(120) especialidad?: string;
  @IsOptional() @IsIn(['nombrado', 'contratado']) tipo?: 'nombrado' | 'contratado';
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) password?: string;
}

export class DocenteQueryDto {
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() sede?: string;
  @IsOptional() @IsString() busqueda?: string;
  @IsOptional() @IsInt() anioEscolar?: number;
}
