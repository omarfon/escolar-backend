import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendancesModule } from '../attendances/attendances.module';
import { EventsModule } from '../events/events.module';
import { Grade } from '../grades/entities/grade.entity';
import { HorariosModule } from '../horarios/horarios.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { StudentsModule } from '../students/students.module';
import { TasksModule } from '../tasks/tasks.module';
import { ParentStudent } from './entities/parent-student.entity';
import { ParentTeacherMessage } from './entities/parent-teacher-message.entity';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParentStudent, Grade, Docente, ParentTeacherMessage]),
    StudentsModule,
    AttendancesModule,
    TasksModule,
    EventsModule,
    HorariosModule,
    TreasuryModule,
  ],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
