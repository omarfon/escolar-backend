import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { CreateAuditLogDto } from './dto/audit-log.dto';

@Injectable()
export class AuditWriteQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditWriteQueueService.name);
  private readonly buffer: CreateAuditLogDto[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly batchSize = Number(process.env.AUDIT_QUEUE_BATCH_SIZE ?? 25);
  private readonly flushIntervalMs = Number(
    process.env.AUDIT_QUEUE_FLUSH_MS ?? 200,
  );

  constructor(private readonly auditLogsService: AuditLogsService) {}

  onModuleInit(): void {
    this.scheduleFlush();
  }

  enqueue(dto: CreateAuditLogDto): void {
    this.buffer.push(dto);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
      return;
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.buffer.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.buffer.splice(0, this.batchSize);
    try {
      await this.auditLogsService.createMany(batch);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Fallo al persistir lote de auditoría (${batch.length}): ${message}`,
      );
      for (const item of batch) {
        try {
          await this.auditLogsService.create(item);
        } catch (singleErr) {
          const singleMessage =
            singleErr instanceof Error ? singleErr.message : String(singleErr);
          this.logger.warn(`No se pudo registrar bitácora: ${singleMessage}`);
        }
      }
    } finally {
      this.flushing = false;
      if (this.buffer.length) this.scheduleFlush();
    }
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }
}
