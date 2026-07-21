import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AUDIT_LOG_CLEANUP_INTERVAL_MS } from './audit-logs.constants';
import { AuditLogsService } from './audit-logs.service';

@Injectable()
export class AuditLogsCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly auditLogsService: AuditLogsService) {}

  async onModuleInit(): Promise<void> {
    await this.runCleanup();
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, AUDIT_LOG_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCleanup(): Promise<void> {
    try {
      const deleted = await this.auditLogsService.purgeExpired();
      if (deleted > 0) {
        this.logger.log(`Eliminados ${deleted} registros de bitácora vencidos`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al limpiar bitácora: ${message}`);
    }
  }
}
