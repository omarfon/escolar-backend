import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGradeLevelDto {
  @IsString() @MaxLength(80) nombre: string;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}

export class UpdateGradeLevelDto {
  @IsOptional() @IsString() @MaxLength(80) nombre?: string;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}
