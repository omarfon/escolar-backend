import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  ENROLLMENT_REPORT_TYPES,
  ESTADOS_MATRICULA,
  EXPORT_FORMATS,
  MAX_PAGE_SIZE,
  type EnrollmentReportType,
  type ExportFormat,
} from '../enrollment-reports.constants';

export class EnrollmentReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  institutionId?: number;

  @IsOptional()
  @IsString()
  _tenant?: string;

  @IsIn([...ENROLLMENT_REPORT_TYPES])
  tipo: EnrollmentReportType;

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
  periodo?: number;

  @IsOptional()
  @IsString()
  dre?: string;

  @IsOptional()
  @IsString()
  ugel?: string;

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
  @IsIn([...ESTADOS_MATRICULA])
  estadoMatricula?: (typeof ESTADOS_MATRICULA)[number];

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

export class EnrollmentReportExportQueryDto extends EnrollmentReportQueryDto {
  @IsIn([...EXPORT_FORMATS])
  format: ExportFormat;
}

export class CreateEnrollmentReportJobDto extends EnrollmentReportExportQueryDto {}

export function normalizeEnrollmentReportQuery(dto: EnrollmentReportQueryDto) {
  return {
    tipo: dto.tipo,
    anio: dto.anio,
    periodo: dto.periodo,
    dre: dto.dre?.trim() || undefined,
    ugel: dto.ugel?.trim() || undefined,
    nivel: dto.nivel?.trim() || undefined,
    grado: dto.grado?.trim() || undefined,
    seccion: dto.seccion?.trim()?.toUpperCase() || undefined,
    estadoMatricula: dto.estadoMatricula,
    busqueda: dto.busqueda?.trim() || undefined,
    page: dto.page ?? 1,
    pageSize: Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type NormalizedEnrollmentReportQuery = ReturnType<
  typeof normalizeEnrollmentReportQuery
>;
