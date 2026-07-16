import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Classroom } from './entities/classroom.entity';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';
import { Student } from '../students/entities/student.entity';
import { ContinuityEnrollment } from '../continuity-enrollment/entities/continuity-enrollment.entity';
import { EducationLevel } from '../institution/entities/education-level.entity';
import { GradeLevel } from '../institution/entities/grade-level.entity';
import { GradeSection } from '../institution/entities/grade-section.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Classroom,
      Student,
      ContinuityEnrollment,
      EducationLevel,
      GradeLevel,
      GradeSection,
    ]),
    AuthModule,
  ],
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
