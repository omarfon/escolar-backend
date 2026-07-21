import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculaModule } from '../curricula/curricula.module';
import { StudentsModule } from '../students/students.module';
import { CompetencyEvaluation } from './entities/competency-evaluation.entity';
import { CompetencyEvaluationsController } from './competency-evaluations.controller';
import { CompetencyEvaluationsService } from './competency-evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompetencyEvaluation]),
    StudentsModule,
    CurriculaModule,
  ],
  controllers: [CompetencyEvaluationsController],
  providers: [CompetencyEvaluationsService],
  exports: [CompetencyEvaluationsService],
})
export class CompetencyEvaluationsModule {}
