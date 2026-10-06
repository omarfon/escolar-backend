import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const AMBITOS = ['MINEDU', 'DRE', 'UGEL', 'IE'] as const;
export type AmbitoTerritorialDto = (typeof AMBITOS)[number];

export class RoleAssignmentItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  roleCodigo: string;

  @IsIn(AMBITOS)
  ambito: AmbitoTerritorialDto;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dreCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ugelCodigo?: string;

  @IsOptional()
  @IsInt()
  institutionId?: number;

  @IsBoolean()
  esPrincipal: boolean;
}

export class SetUserRoleAssignmentsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentItemDto)
  assignments: RoleAssignmentItemDto[];
}

export interface UserRoleAssignmentResponse {
  id: number;
  roleCodigo: string;
  roleLabel: string;
  ambito: AmbitoTerritorialDto;
  dreCodigo: string | null;
  ugelCodigo: string | null;
  institutionId: number | null;
  esPrincipal: boolean;
  activo: boolean;
  motivo: string;
  createdAt: string;
  revokedAt: string | null;
}
