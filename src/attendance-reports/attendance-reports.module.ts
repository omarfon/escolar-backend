import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { Student } from '../students/entities/student.entity';
import { AttendanceReportJob } from './entities/attendance-report-job.entity';
import { AttendanceReportsController } from './attendance-reports.controller';
import { AttendanceReportsExportService } from './attendance-reports-export.service';
import { AttendanceReportsJobService } from './attendance-reports-job.service';
import { AttendanceReportsService } from './attendance-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Student, Attendance, AttendanceReportJob]),
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [AttendanceReportsController],
  providers: [
    AttendanceReportsService,
    AttendanceReportsExportService,
    AttendanceReportsJobService,
  ],
  exports: [AttendanceReportsService],
})
export class AttendanceReportsModule {}
