import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permisos: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
