import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class CalendarioQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anioEscolar?: number;

  /** Mes calendario en formato YYYY-MM */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'mes debe tener formato YYYY-MM',
  })
  mes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta?: string;

  /** Solo SIAGIE: institución a consultar */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  institutionId?: number;
}
