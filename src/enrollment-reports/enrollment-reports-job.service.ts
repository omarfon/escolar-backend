import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { LessThan, Repository } from 'typeorm';
import type { Request } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import type { ReportScope } from '../evaluation-reports/evaluation-reports-scope.util';
import type { NormalizedEnrollmentReportQuery } from './dto/enrollment-report-query.dto';
import { EnrollmentReportJob } from './entities/enrollment-report-job.entity';
import {
  JOB_FILE_RETENTION_DAYS,
  SYNC_EXPORT_MAX_ROWS,
  type ExportFormat,
} from './enrollment-reports.constants';
import { EnrollmentReportsExportService } from './enrollment-reports-export.service';
import { EnrollmentReportsService } from './enrollment-reports.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'enrollment-reports');

@Injectable()
export class EnrollmentReportsJobService implements OnModuleInit, OnModuleDestroy {
  private readonly timers = new Set<NodeJS.Timeout>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(EnrollmentReportJob)
    private readonly jobRepo: Repository<EnrollmentReportJob>,
    private readonly reportsService: EnrollmentReportsService,
    private readonly exportService: EnrollmentReportsExportService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  onModuleInit(): void {
    void this.purgeExpiredJobs().catch(() => undefined);
    this.cleanupTimer = setInterval(
      () => void this.purgeExpiredJobs().catch(() => undefined),
      6 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async listJobs(scope: ReportScope, limit = 20): Promise<EnrollmentReportJob[]> {
    return this.jobRepo.find({
      where: { scopeKey: scope.scopeKey },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async createJob(
    query: NormalizedEnrollmentReportQuery & { format: ExportFormat },
    scope: ReportScope,
    user: RequestUser | undefined,
    req: Request,
  ): Promise<EnrollmentReportJob> {
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        institutionId: scope.primaryInstitutionId,
        scopeKey: scope.scopeKey,
        reportType: query.tipo,
        format: query.format,
        status: 'pending',
        filtros: { ...query, alcance: scope.alcance },
        solicitadoPor: user?.id ? Number(user.id) : undefined,
        solicitadoPorNombre: user?.nombre ?? user?.username,
      }),
    );

    const timer = setTimeout(() => {
      void this.processJob(job.id, scope, req).catch(() => undefined);
    }, 10);
    this.timers.add(timer);

    return job;
  }

  async findJob(jobId: number, scope: ReportScope): Promise<EnrollmentReportJob> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, scopeKey: scope.scopeKey },
    });
    if (!job) {
      throw new NotFoundException('Trabajo de reporte no encontrado');
    }
    return job;
  }

  async readJobFile(job: EnrollmentReportJob): Promise<Buffer> {
    if (!job.archivoPath) {
      throw new NotFoundException('El archivo del reporte aún no está disponible');
    }
    return readFile(job.archivoPath);
  }

  private async processJob(
    jobId: number,
    scope: ReportScope,
    req: Request,
  ): Promise<void> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, scopeKey: scope.scopeKey },
    });
    if (!job || job.status !== 'pending') return;

    await this.jobRepo.update(jobId, { status: 'processing' });

    try {
      const filtros = job.filtros as NormalizedEnrollmentReportQuery & {
        format: ExportFormat;
      };
      const report = await this.reportsService.buildReport(
        { ...filtros, page: 1, pageSize: SYNC_EXPORT_MAX_ROWS },
        scope,
      );
      const { buffer, extension } = await this.exportService.buildBuffer(
        report,
        job.format as ExportFormat,
      );
      await mkdir(UPLOAD_DIR, { recursive: true });
      const filename = `matricula-${job.reportType}-${jobId}.${extension}`;
      const filePath = join(UPLOAD_DIR, filename);
      await writeFile(filePath, buffer);

      await this.jobRepo.update(jobId, {
        status: 'completed',
        totalFilas: report.pagination.totalItems,
        archivoPath: filePath,
        archivoNombre: filename,
        completedAt: new Date(),
      });

      this.auditLogger.logFromRequestContext(req, {
        accion: 'exportar',
        modulo: 'matricula',
        entidad: 'reporte',
        descripcion: `Exportación asíncrona ${job.reportType} (${job.format}) completada`,
        institutionId: scope.primaryInstitutionId,
        detalle: {
          jobId,
          tipo: job.reportType,
          format: job.format,
          totalFilas: report.pagination.totalItems,
          scopeKey: scope.scopeKey,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      await this.jobRepo.update(jobId, {
        status: 'failed',
        errorMensaje: message,
        completedAt: new Date(),
      });
    }
  }

  private async purgeExpiredJobs(): Promise<void> {
    const cutoff = new Date(
      Date.now() - JOB_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const expired = await this.jobRepo.find({
      where: { createdAt: LessThan(cutoff) },
      take: 200,
    });

    for (const job of expired) {
      if (job.archivoPath) {
        await unlink(job.archivoPath).catch(() => undefined);
      }
      await this.jobRepo.delete(job.id);
    }
  }
}
