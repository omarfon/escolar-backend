import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  EVALUATION_REPORT_TYPES,
  EXPORT_FORMATS,
  MAX_PAGE_SIZE,
  type EvaluationReportType,
  type ExportFormat,
} from '../evaluation-reports.constants';

export class EvaluationReportQueryDto {
  @IsIn([...EVALUATION_REPORT_TYPES])
  tipo: EvaluationReportType;

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
  @IsString()
  dre?: string;

  @IsOptional()
  @IsString()
  ugel?: string;

  @ValidateIf((o) => o.tipo !== 'promedios' || !!o.nivel)
  @IsOptional()
  @IsString()
  nivel?: string;

  @ValidateIf((o) => ['promedios', 'notas', 'competencias', 'diagnostico'].includes(o.tipo))
  @IsOptional()
  @IsString()
  grado?: string;

  @ValidateIf((o) => ['promedios', 'notas', 'competencias', 'diagnostico'].includes(o.tipo))
  @IsOptional()
  @IsString()
  seccion?: string;

  @IsOptional()
  @IsString()
  curso?: string;

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

export class EvaluationReportExportQueryDto extends EvaluationReportQueryDto {
  @IsIn([...EXPORT_FORMATS])
  format: ExportFormat;
}

export class CreateEvaluationReportJobDto extends EvaluationReportExportQueryDto {}

export function normalizeReportQuery(dto: EvaluationReportQueryDto) {
  return {
    tipo: dto.tipo,
    anio: dto.anio,
    bimestre: dto.bimestre,
    dre: dto.dre?.trim() || undefined,
    ugel: dto.ugel?.trim() || undefined,
    nivel: dto.nivel?.trim() || undefined,
    grado: dto.grado?.trim() || undefined,
    seccion: dto.seccion?.trim()?.toUpperCase() || undefined,
    curso: dto.curso?.trim() || undefined,
    busqueda: dto.busqueda?.trim() || undefined,
    page: dto.page ?? 1,
    pageSize: Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type NormalizedReportQuery = ReturnType<typeof normalizeReportQuery>;
