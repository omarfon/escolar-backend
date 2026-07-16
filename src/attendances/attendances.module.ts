import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsModule } from '../students/students.module';
import { AttendancesService } from './attendances.service';
import { AttendancesController } from './attendances.controller';
import { AttendanceAlertSettings } from './entities/attendance-alert-settings.entity';
import { AttendanceJustification } from './entities/attendance-justification.entity';
import { Attendance } from './entities/attendance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      AttendanceJustification,
      AttendanceAlertSettings,
    ]),
    StudentsModule,
  ],
  controllers: [AttendancesController],
  providers: [AttendancesService],
  exports: [AttendancesService],
})
export class AttendancesModule {}
