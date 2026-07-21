import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { TemarioClase } from './entities/temario-clase.entity';
import { TemarioController } from './temario.controller';
import { TemarioService } from './temario.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TemarioClase,
      Docente,
      CurriculumTeacherAssignment,
      CurriculumSubject,
      Student,
      User,
    ]),
    AuthModule,
  ],
  controllers: [TemarioController],
  providers: [TemarioService],
  exports: [TemarioService],
})
export class TemarioModule {}
