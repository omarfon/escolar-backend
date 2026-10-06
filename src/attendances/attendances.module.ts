import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import { StudentsModule } from '../students/students.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { Institution } from '../institution/entities/institution.entity';
import { Student } from '../students/entities/student.entity';
import { AttendancesService } from './attendances.service';
import { AttendancesController } from './attendances.controller';
import { AttendanceRecurrentAlertsService } from './attendance-recurrent-alerts.service';
import { AttendanceAlertSettings } from './entities/attendance-alert-settings.entity';
import { AttendanceAlertNotification } from './entities/attendance-alert-notification.entity';
import { AttendanceJustification } from './entities/attendance-justification.entity';
import { AttendanceRecurrentAlert } from './entities/attendance-recurrent-alert.entity';
import { AttendanceRecurrentAlertAction } from './entities/attendance-recurrent-alert-action.entity';
import { Attendance } from './entities/attendance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      AttendanceJustification,
      AttendanceAlertSettings,
      AttendanceAlertNotification,
      AttendanceRecurrentAlert,
      AttendanceRecurrentAlertAction,
      Institution,
      Student,
    ]),
    StudentsModule,
    MaestrosModule,
    MailModule,
    AuditLogsModule,
  ],
  controllers: [AttendancesController],
  providers: [AttendancesService, AttendanceRecurrentAlertsService],
  exports: [AttendancesService, AttendanceRecurrentAlertsService],
})
export class AttendancesModule {}
