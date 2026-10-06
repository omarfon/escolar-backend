import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ContinuityEnrollment } from '../continuity-enrollment/entities/continuity-enrollment.entity';
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { EnrollmentFeedback } from '../enrollment-feedback/entities/enrollment-feedback.entity';
import { TransferRequestEvent } from '../transfers/entities/transfer-request-event.entity';
import { TransferRequest } from '../transfers/entities/transfer-request.entity';
import { Institution } from '../institution/entities/institution.entity';
import { SectionChange } from '../students/entities/section-change.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { StudentReadmission } from '../students/entities/student-readmission.entity';
import { StudentWithdrawal } from '../students/entities/student-withdrawal.entity';
import { Student } from '../students/entities/student.entity';
import { StudentsModule } from '../students/students.module';
import { EnrollmentHistoryController } from './enrollment-history.controller';
import { EnrollmentHistoryService } from './enrollment-history.service';

@Module({
  imports: [
    AuditLogsModule,
    StudentsModule,
    TypeOrmModule.forFeature([
      Student,
      StudentAcademicHistory,
      StudentWithdrawal,
      StudentReadmission,
      SectionChange,
      ContinuityEnrollment,
      EnrollmentEvaluation,
      EnrollmentFeedback,
      TransferRequest,
      TransferRequestEvent,
      Institution,
    ]),
  ],
  controllers: [EnrollmentHistoryController],
  providers: [EnrollmentHistoryService],
  exports: [EnrollmentHistoryService],
})
export class EnrollmentHistoryModule {}
