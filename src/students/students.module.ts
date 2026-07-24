import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../attendances/entities/attendance.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { SectionChange } from './entities/section-change.entity';
import { StudentAcademicHistory } from './entities/student-academic-history.entity';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { MaestrosModule } from '../maestros/maestros.module';
import { HorarioBlock } from '../horarios/entities/horario-block.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { CurriculumArea } from '../curricula/entities/curriculum-area.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      SectionChange,
      Schedule,
      StudentDocument,
      StudentAcademicHistory,
      Attendance,
      Grade,
      HorarioBlock,
      Docente,
      CurriculumArea,
      CurriculumSubject,
      User,
    ]),
    MaestrosModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
