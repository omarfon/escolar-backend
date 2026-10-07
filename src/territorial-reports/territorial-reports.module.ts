import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { Student } from '../students/entities/student.entity';
import { TerritorialReportsController } from './territorial-reports.controller';
import { TerritorialReportsExportService } from './territorial-reports-export.service';
import { TerritorialReportsService } from './territorial-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Student, Attendance, Grade]),
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [TerritorialReportsController],
  providers: [TerritorialReportsService, TerritorialReportsExportService],
  exports: [TerritorialReportsService],
})
export class TerritorialReportsModule {}
