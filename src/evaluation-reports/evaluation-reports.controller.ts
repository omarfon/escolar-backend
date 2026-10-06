import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  CreateEvaluationReportJobDto,
  EvaluationReportExportQueryDto,
  EvaluationReportQueryDto,
  normalizeReportQuery,
} from './dto/evaluation-report-query.dto';
import {
  ASYNC_EXPORT_ROW_THRESHOLD,
  SYNC_EXPORT_MAX_ROWS,
} from './evaluation-reports.constants';
import { EvaluationReportsExportService } from './evaluation-reports-export.service';
import { EvaluationReportsJobService } from './evaluation-reports-job.service';
import { EvaluationReportsService } from './evaluation-reports.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('evaluation-reports')
@RequirePermiso('evaluacion.reportes')
export class EvaluationReportsController {
  constructor(
    private readonly reportsService: EvaluationReportsService,
    private readonly exportService: EvaluationReportsExportService,
    private readonly jobService: EvaluationReportsJobService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @Get('context')
  async getContext(
    @Req() req: AuthRequest,
    @Query('dre') dre?: string,
    @Query('ugel') ugel?: string,
  ) {
    const scope = await this.reportsService.resolveScope(req, dre, ugel);
    return this.reportsService.getContext(scope);
  }

  @Get()
  async findReport(@Query() query: EvaluationReportQueryDto, @Req() req: AuthRequest) {
    const scope = await this.reportsService.resolveScope(req, query.dre, query.ugel);
    const normalized = normalizeReportQuery(query);
    const report = await this.reportsService.buildReport(normalized, scope);

    this.auditLogger.logFromRequestContext(req, {
      accion: 'consultar',
      modulo: 'evaluacion',
      entidad: 'reporte',
      descripcion: `Consultó reporte ${normalized.tipo}`,
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
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  async exportReport(
    @Query() query: EvaluationReportExportQueryDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const scope = await this.reportsService.resolveScope(req, query.dre, query.ugel);
    const normalized = normalizeReportQuery(query);
    const fullQuery = { ...normalized, page: 1, pageSize: SYNC_EXPORT_MAX_ROWS };
    const report = await this.reportsService.buildReport(fullQuery, scope);

    if (report.pagination.totalItems > SYNC_EXPORT_MAX_ROWS) {
      res.status(400).json({
        message: `El reporte supera ${SYNC_EXPORT_MAX_ROWS} filas. Use exportación asíncrona (POST /evaluation-reports/jobs).`,
        totalFilas: report.pagination.totalItems,
        umbralAsync: ASYNC_EXPORT_ROW_THRESHOLD,
      });
      return;
    }

    const { buffer, mimeType, extension } = await this.exportService.buildBuffer(
      report,
      query.format,
    );
    const filename = `reporte-${normalized.tipo}.${extension}`;

    this.auditLogger.logFromRequestContext(req, {
      accion: 'exportar',
      modulo: 'evaluacion',
      entidad: 'reporte',
      descripcion: `Exportó reporte ${normalized.tipo} (${query.format})`,
      institutionId: scope.primaryInstitutionId,
      detalle: {
        tipo: normalized.tipo,
        format: query.format,
        totalFilas: report.pagination.totalItems,
        parametros: normalized,
        scopeKey: scope.scopeKey,
      },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('jobs')
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  async listJobs(
    @Req() req: AuthRequest,
    @Query('dre') dre?: string,
    @Query('ugel') ugel?: string,
  ) {
    const scope = await this.reportsService.resolveScope(req, dre, ugel);
    return this.jobService.listJobs(scope);
  }

  @Post('jobs')
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  async createExportJob(
    @Body() dto: CreateEvaluationReportJobDto,
    @Req() req: AuthRequest,
  ) {
    const scope = await this.reportsService.resolveScope(req, dto.dre, dto.ugel);
    const normalized = normalizeReportQuery(dto);
    const preview = await this.reportsService.buildReport(
      { ...normalized, page: 1, pageSize: 1 },
      scope,
    );

    if (preview.pagination.totalItems <= ASYNC_EXPORT_ROW_THRESHOLD) {
      return {
        async: false,
        message: 'El volumen permite exportación síncrona via GET /evaluation-reports/export',
        totalFilas: preview.pagination.totalItems,
        umbralAsync: ASYNC_EXPORT_ROW_THRESHOLD,
      };
    }

    const job = await this.jobService.createJob(
      { ...normalized, format: dto.format },
      scope,
      req.user,
      req,
    );

    this.auditLogger.logFromRequestContext(req, {
      accion: 'exportar',
      modulo: 'evaluacion',
      entidad: 'reporte_job',
      descripcion: `Encoló exportación asíncrona ${normalized.tipo} (${dto.format})`,
      institutionId: scope.primaryInstitutionId,
      detalle: { jobId: job.id, tipo: normalized.tipo, format: dto.format, scopeKey: scope.scopeKey },
    });

    return {
      async: true,
      jobId: job.id,
      status: job.status,
      totalFilasEstimadas: preview.pagination.totalItems,
    };
  }

  @Get('jobs/:id')
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  async getJob(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Query('dre') dre?: string,
    @Query('ugel') ugel?: string,
  ) {
    const scope = await this.reportsService.resolveScope(req, dre, ugel);
    return this.jobService.findJob(+id, scope);
  }

  @Get('jobs/:id/download')
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  async downloadJob(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
    @Query('dre') dre?: string,
    @Query('ugel') ugel?: string,
  ) {
    const scope = await this.reportsService.resolveScope(req, dre, ugel);
    const job = await this.jobService.findJob(+id, scope);
    if (job.status !== 'completed' || !job.archivoNombre) {
      res.status(409).json({
        message: 'El reporte aún no está listo para descarga',
        status: job.status,
        errorMensaje: job.errorMensaje,
      });
      return;
    }

    const buffer = await this.jobService.readJobFile(job);
    const ext = job.format;
    const mime =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8';

    this.auditLogger.logFromRequestContext(req, {
      accion: 'exportar',
      modulo: 'evaluacion',
      entidad: 'reporte_job',
      descripcion: `Descargó exportación asíncrona ${job.reportType}`,
      institutionId: scope.primaryInstitutionId,
      detalle: { jobId: job.id, totalFilas: job.totalFilas, scopeKey: scope.scopeKey },
    });

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${job.archivoNombre}"`,
    );
    res.send(buffer);
  }
}
