import { IsOptional, IsString, Matches } from 'class-validator';

export class ControlReportQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'mes debe ser YYYY-MM' })
  mes?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  grado?: string;

  @IsOptional()
  @IsString()
  seccion?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;
}
