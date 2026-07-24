import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculaModule } from '../curricula/curricula.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { CompetencyEvaluation } from './entities/competency-evaluation.entity';
import { CompetencyEvaluationsController } from './competency-evaluations.controller';
import { CompetencyEvaluationsService } from './competency-evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetencyEvaluation,
      Docente,
      CurriculumTeacherAssignment,
    ]),
    StudentsModule,
    CurriculaModule,
    MaestrosModule,
  ],
  controllers: [CompetencyEvaluationsController],
  providers: [CompetencyEvaluationsService],
  exports: [CompetencyEvaluationsService],
})
export class CompetencyEvaluationsModule {}
