import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleAssignmentItemDto } from './user-role-assignment.dto';

const ROLES = [
  'ADMIN', 'DIRECTOR', 'DOCENTE', 'SECRETARIA', 'TESORERO',
  'PADRE', 'ESTUDIANTE', 'BIBLIOTECARIO', 'UGEL', 'DRE', 'MINEDU',
] as const;
const ESTADOS = ['activo', 'inactivo', 'bloqueado'] as const;

export class CreateUserDto {
  @IsString() @MaxLength(80) nombres: string;
  @IsString() @MaxLength(80) apellidos: string;
  @IsString() @MinLength(8) @MaxLength(8) dni: string;
  @IsEmail() @MaxLength(120) email: string;
  @IsOptional() @IsString() @MaxLength(50) username?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsIn(ROLES) rol: (typeof ROLES)[number];
  @IsOptional() @IsString() @MaxLength(80) sede?: string;
  @IsOptional() @IsIn(ESTADOS) estado?: (typeof ESTADOS)[number];
  @IsOptional() @IsString() @MaxLength(120) cargo?: string;
  @IsString() @MinLength(8) @MaxLength(100) password: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentItemDto)
  roleAssignments?: RoleAssignmentItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleAssignmentsMotivo?: string;
}
