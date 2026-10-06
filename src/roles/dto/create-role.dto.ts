import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permisos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  basadoEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  institutionId?: number;
}
