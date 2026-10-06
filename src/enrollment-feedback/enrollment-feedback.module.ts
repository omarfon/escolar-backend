import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EnrollmentEvaluation } from '../enrollment-evaluations/entities/enrollment-evaluation.entity';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { EnrollmentFeedbackController } from './enrollment-feedback.controller';
import { EnrollmentFeedback } from './entities/enrollment-feedback.entity';
import { EnrollmentFeedbackService } from './enrollment-feedback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentFeedback,
      EnrollmentEvaluation,
      Institution,
    ]),
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [EnrollmentFeedbackController],
  providers: [EnrollmentFeedbackService],
  exports: [EnrollmentFeedbackService],
})
export class EnrollmentFeedbackModule {}
