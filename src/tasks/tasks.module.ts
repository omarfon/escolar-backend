import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaestrosModule } from '../maestros/maestros.module';
import { TeacherResource } from '../resources/entities/teacher-resource.entity';
import { Student } from '../students/entities/student.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Student, TeacherResource]),
    MaestrosModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
