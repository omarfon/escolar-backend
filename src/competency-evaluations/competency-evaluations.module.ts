import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { Institution } from '../institution/entities/institution.entity';
import { CurriculaModule } from '../curricula/curricula.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { PromediosModule } from '../promedios/promedios.module';
import { StudentsModule } from '../students/students.module';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { CompetencyChangeAuditService } from './competency-change-audit.service';
import { CompetencyEvaluation } from './entities/competency-evaluation.entity';
import { CompetencyChangeLog } from './entities/competency-change-log.entity';
import { CompetencyEvaluationsController } from './competency-evaluations.controller';
import { CompetencyEvaluationsService } from './competency-evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetencyEvaluation,
      CompetencyChangeLog,
      Docente,
      CurriculumSubject,
      CurriculumTeacherAssignment,
      EvaluationActa,
      Institution,
    ]),
    StudentsModule,
    CurriculaModule,
    MaestrosModule,
    PromediosModule,
    AuditLogsModule,
  ],
  controllers: [CompetencyEvaluationsController],
  providers: [CompetencyEvaluationsService, CompetencyChangeAuditService],
  exports: [CompetencyEvaluationsService, CompetencyChangeAuditService],
})
export class CompetencyEvaluationsModule {}
