import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSectionChangeRequestDto {
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  seccionDeseada?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  motivo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  autorizadoPor: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  solicitadoPor?: string;
}
