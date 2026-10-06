import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from '../institution/entities/institution.entity';
import { AuditLogsCleanupService } from './audit-logs-cleanup.service';
import { AuditLoggerService } from './audit-logger.service';
import { AuditWriteQueueService } from './audit-write-queue.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Institution])],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    AuditLogsCleanupService,
    AuditWriteQueueService,
    AuditLoggerService,
    AuditInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditLogsService, AuditLoggerService],
})
export class AuditLogsModule {}
