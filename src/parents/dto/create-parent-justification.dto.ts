import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateParentJustificationDto {
  @IsInt()
  @Min(1)
  @Max(30)
  cantidad: number;

  @IsString()
  @MinLength(2)
  motivo: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
