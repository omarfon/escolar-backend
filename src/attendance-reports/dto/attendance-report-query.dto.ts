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
  ATTENDANCE_REPORT_TYPES,
  DEFAULT_PAGE_SIZE,
  ESTADOS_ASISTENCIA,
  EXPORT_FORMATS,
  MAX_PAGE_SIZE,
  type AttendanceReportType,
  type ExportFormat,
} from '../attendance-reports.constants';

export class AttendanceReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  institutionId?: number;

  @IsOptional()
  @IsString()
  _tenant?: string;

  @IsIn([...ATTENDANCE_REPORT_TYPES])
  tipo: AttendanceReportType;

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
  @Matches(/^\d{4}-\d{2}$/, { message: 'mes debe ser YYYY-MM' })
  mes?: string;

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
  @IsIn([...ESTADOS_ASISTENCIA])
  estado?: (typeof ESTADOS_ASISTENCIA)[number];

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

export class AttendanceReportExportQueryDto extends AttendanceReportQueryDto {
  @IsIn([...EXPORT_FORMATS])
  format: ExportFormat;
}

export class CreateAttendanceReportJobDto extends AttendanceReportExportQueryDto {}

export function normalizeAttendanceReportQuery(dto: AttendanceReportQueryDto) {
  return {
    tipo: dto.tipo,
    anio: dto.anio,
    periodo: dto.periodo,
    mes: dto.mes?.trim() || undefined,
    dre: dto.dre?.trim() || undefined,
    ugel: dto.ugel?.trim() || undefined,
    nivel: dto.nivel?.trim() || undefined,
    grado: dto.grado?.trim() || undefined,
    seccion: dto.seccion?.trim()?.toUpperCase() || undefined,
    estado: dto.estado,
    busqueda: dto.busqueda?.trim() || undefined,
    page: dto.page ?? 1,
    pageSize: Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type NormalizedAttendanceReportQuery = ReturnType<
  typeof normalizeAttendanceReportQuery
>;
