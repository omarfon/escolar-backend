import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateEducationLevelDto {
  @IsString() @MaxLength(80) nombre: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}

export class UpdateEducationLevelDto {
  @IsOptional() @IsString() @MaxLength(80) nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}
