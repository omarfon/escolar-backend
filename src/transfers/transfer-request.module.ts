import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';
import { Student } from '../students/entities/student.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentDocumentsModule } from '../students/student-documents.module';
import { TransferEnrollmentService } from './transfer-enrollment.service';
import { TransferVacancyService } from './transfer-vacancy.service';
import { TransferNotification } from './entities/transfer-notification.entity';
import { TransferRequestEvent } from './entities/transfer-request-event.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import { TransferRequestController } from './transfer-request.controller';
import { TransferNotificationDeliveryService } from './transfer-notification-delivery.service';
import { TransferNotificationService } from './transfer-notification.service';
import { TransferRecipientResolverService } from './transfer-recipient-resolver.service';
import { TransferRequestService } from './transfer-request.service';

@Module({
  imports: [
    AuditLogsModule,
    MailModule,
    StudentDocumentsModule,
    MaestrosModule,
    TypeOrmModule.forFeature([
      TransferRequest,
      TransferRequestEvent,
      TransferNotification,
      Student,
      Institution,
      AuditLog,
    ]),
  ],
  controllers: [TransferRequestController],
  providers: [
    TransferRequestService,
    TransferNotificationService,
    TransferNotificationDeliveryService,
    TransferRecipientResolverService,
    TransferVacancyService,
    TransferEnrollmentService,
  ],
  exports: [
    TransferRequestService,
    TransferNotificationService,
    TransferVacancyService,
    TransferEnrollmentService,
  ],
})
export class TransfersModule {}
