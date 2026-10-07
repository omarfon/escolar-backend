import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { Student } from '../students/entities/student.entity';
import { EnrollmentReportJob } from './entities/enrollment-report-job.entity';
import { EnrollmentReportsController } from './enrollment-reports.controller';
import { EnrollmentReportsExportService } from './enrollment-reports-export.service';
import { EnrollmentReportsJobService } from './enrollment-reports-job.service';
import { EnrollmentReportsService } from './enrollment-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Student, EnrollmentReportJob]),
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [EnrollmentReportsController],
  providers: [
    EnrollmentReportsService,
    EnrollmentReportsExportService,
    EnrollmentReportsJobService,
  ],
  exports: [EnrollmentReportsService],
})
export class EnrollmentReportsModule {}
