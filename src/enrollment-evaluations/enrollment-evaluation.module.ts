import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { Student } from '../students/entities/student.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { EnrollmentEvaluationController } from './enrollment-evaluation.controller';
import { EnrollmentEvaluation } from './entities/enrollment-evaluation.entity';
import { EnrollmentEvaluationService } from './enrollment-evaluation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentEvaluation,
      WaitlistEntry,
      Student,
      Institution,
    ]),
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [EnrollmentEvaluationController],
  providers: [EnrollmentEvaluationService],
  exports: [EnrollmentEvaluationService],
})
export class EnrollmentEvaluationsModule {}
