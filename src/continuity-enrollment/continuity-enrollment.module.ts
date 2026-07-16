import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContinuityEnrollment } from './entities/continuity-enrollment.entity';
import { ContinuityEnrollmentController } from './continuity-enrollment.controller';
import { ContinuityEnrollmentService } from './continuity-enrollment.service';
import { Student } from '../students/entities/student.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Grade } from '../grades/entities/grade.entity';
import { AuthModule } from '../auth/auth.module';
import { ClassroomsModule } from '../classrooms/classrooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContinuityEnrollment,
      Student,
      StudentAcademicHistory,
      Grade,
    ]),
    AuthModule,
    ClassroomsModule,
  ],
  controllers: [ContinuityEnrollmentController],
  providers: [ContinuityEnrollmentService],
  exports: [ContinuityEnrollmentService],
})
export class ContinuityEnrollmentModule {}
