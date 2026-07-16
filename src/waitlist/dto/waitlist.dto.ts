import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const PRIORIDADES = ['alta', 'media', 'baja'] as const;

export class CreateWaitlistDto {
  @IsString() @MaxLength(80) nombres: string;
  @IsString() @MaxLength(80) apellidos: string;
  @IsString() @MinLength(8) @MaxLength(8) dni: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsString() @MaxLength(20) nivel: string;
  @IsString() @MaxLength(20) grado: string;
  @IsOptional() @IsString() @MaxLength(5) seccionDeseada?: string;
  @IsOptional() @IsIn(PRIORIDADES) prioridad?: (typeof PRIORIDADES)[number];
  @IsOptional() @IsString() @MaxLength(300) observacion?: string;
}

export class UpdateWaitlistDto {
  @IsOptional() @IsString() @MaxLength(80) nombres?: string;
  @IsOptional() @IsString() @MaxLength(80) apellidos?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(20) nivel?: string;
  @IsOptional() @IsString() @MaxLength(20) grado?: string;
  @IsOptional() @IsString() @MaxLength(5) seccionDeseada?: string;
  @IsOptional() @IsIn(PRIORIDADES) prioridad?: (typeof PRIORIDADES)[number];
  @IsOptional() @IsString() @MaxLength(300) observacion?: string;
}

export class AssignWaitlistDto {
  @IsOptional() @IsString() @MaxLength(5) seccion?: string;
}
