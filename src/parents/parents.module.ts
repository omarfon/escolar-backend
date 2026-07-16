import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendancesModule } from '../attendances/attendances.module';
import { Grade } from '../grades/entities/grade.entity';
import { StudentsModule } from '../students/students.module';
import { TasksModule } from '../tasks/tasks.module';
import { ParentStudent } from './entities/parent-student.entity';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParentStudent, Grade]),
    StudentsModule,
    AttendancesModule,
    TasksModule,
  ],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
