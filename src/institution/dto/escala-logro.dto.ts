import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class EscalaLogroDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  AD: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  A: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  B: number;
}
