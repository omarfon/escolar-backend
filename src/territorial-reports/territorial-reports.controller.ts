import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  TerritorialReportExportQueryDto,
  TerritorialReportQueryDto,
  normalizeTerritorialReportQuery,
} from './dto/territorial-report-query.dto';
import { SYNC_EXPORT_MAX_ROWS } from './territorial-reports.constants';
import { TerritorialReportsExportService } from './territorial-reports-export.service';
import { TerritorialReportsService } from './territorial-reports.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('territorial-reports')
@RequirePermiso('dashboard.reportes', 'admin.reportes')
export class TerritorialReportsController {
  constructor(
    private readonly reportsService: TerritorialReportsService,
    private readonly exportService: TerritorialReportsExportService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @Get('context')
  async getContext(
    @Req() req: AuthRequest,
    @Query('dre') dre?: string,
    @Query('ugel') ugel?: string,
  ) {
    const scope = await this.reportsService.resolveScope(req, dre, ugel);
    this.reportsService.assertTerritorialAccess(req.user!, scope);
    return this.reportsService.getContext(scope);
  }

  @Get()
  async findReport(
    @Query() query: TerritorialReportQueryDto,
    @Req() req: AuthRequest,
  ) {
    const scope = await this.reportsService.resolveScope(req, query.dre, query.ugel);
    const normalized = normalizeTerritorialReportQuery(query);
    const report = await this.reportsService.buildReport(
      normalized,
      scope,
      req.user!,
    );

    this.auditLogger.logFromRequestContext(req, {
      accion: 'consultar',
      modulo: 'reportes',
      entidad: 'reporte_territorial',
      descripcion: 'Consultó reporte territorial UGEL/DRE',
      institutionId: scope.primaryInstitutionId,
      detalle: {
        tipo: normalized.tipo,
        parametros: normalized,
        totalFilas: report.pagination.totalItems,
        alcance: scope.alcance,
        scopeKey: scope.scopeKey,
      },
    });

    return report;
  }

  @Get('export')
  async exportReport(
    @Query() query: TerritorialReportExportQueryDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const scope = await this.reportsService.resolveScope(req, query.dre, query.ugel);
    const normalized = normalizeTerritorialReportQuery(query);
    const fullQuery = { ...normalized, page: 1, pageSize: SYNC_EXPORT_MAX_ROWS };
    const report = await this.reportsService.buildReport(
      fullQuery,
      scope,
      req.user!,
    );

    if (report.pagination.totalItems > SYNC_EXPORT_MAX_ROWS) {
      res.status(400).json({
        message: `El reporte supera ${SYNC_EXPORT_MAX_ROWS} filas.`,
        totalFilas: report.pagination.totalItems,
      });
      return;
    }

    const { buffer, mimeType, extension } = await this.exportService.buildBuffer(
      report,
      query.format,
    );

    this.auditLogger.logFromRequestContext(req, {
      accion: 'exportar',
      modulo: 'reportes',
      entidad: 'reporte_territorial',
      descripcion: `Exportó reporte territorial (${query.format})`,
      institutionId: scope.primaryInstitutionId,
      detalle: {
        format: query.format,
        totalFilas: report.pagination.totalItems,
        alcance: scope.alcance,
      },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="territorial-ugel-dre.${extension}"`,
    );
    res.send(buffer);
  }
}
