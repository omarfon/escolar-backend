import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendancesModule } from '../attendances/attendances.module';
import { EventsModule } from '../events/events.module';
import { Grade } from '../grades/entities/grade.entity';
import { HorariosModule } from '../horarios/horarios.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { GradingModule } from '../grading/grading.module';
import { PromediosModule } from '../promedios/promedios.module';
import { TemarioModule } from '../temario/temario.module';
import { ResourcesModule } from '../resources/resources.module';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { ConductIncidentsModule } from '../conduct-incidents/conduct-incidents.module';
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
    ConductIncidentsModule,
    AttendancesModule,
    TasksModule,
    EventsModule,
    HorariosModule,
    TreasuryModule,
    GradingModule,
    PromediosModule,
    TemarioModule,
    ResourcesModule,
  ],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
