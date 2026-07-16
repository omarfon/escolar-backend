import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  nuevaSeccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  realizadoPor?: string;
}
