import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { SectionChange } from './entities/section-change.entity';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { ClassroomsModule } from '../classrooms/classrooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      SectionChange,
      Schedule,
      StudentDocument,
      StudentAcademicHistory,
      Attendance,
    ]),
    ClassroomsModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
