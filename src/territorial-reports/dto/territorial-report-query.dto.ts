import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  EXPORT_FORMATS,
  MAX_PAGE_SIZE,
  TERRITORIAL_REPORT_TYPES,
  type ExportFormat,
  type TerritorialReportType,
} from '../territorial-reports.constants';

export class TerritorialReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  institutionId?: number;

  @IsOptional()
  @IsString()
  _tenant?: string;

  @IsIn([...TERRITORIAL_REPORT_TYPES])
  tipo: TerritorialReportType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  bimestre?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mes?: string;

  @IsOptional()
  @IsString()
  dre?: string;

  @IsOptional()
  @IsString()
  ugel?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export class TerritorialReportExportQueryDto extends TerritorialReportQueryDto {
  @IsIn([...EXPORT_FORMATS])
  format: ExportFormat;
}

export function normalizeTerritorialReportQuery(dto: TerritorialReportQueryDto) {
  return {
    tipo: dto.tipo,
    anio: dto.anio,
    bimestre: dto.bimestre,
    mes: dto.mes?.trim() || undefined,
    dre: dto.dre?.trim() || undefined,
    ugel: dto.ugel?.trim() || undefined,
    busqueda: dto.busqueda?.trim() || undefined,
    page: dto.page ?? 1,
    pageSize: Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type NormalizedTerritorialReportQuery = ReturnType<
  typeof normalizeTerritorialReportQuery
>;
