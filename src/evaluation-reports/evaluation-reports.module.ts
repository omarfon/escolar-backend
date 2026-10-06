import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompetencyEvaluation } from '../competency-evaluations/entities/competency-evaluation.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { DiagnosticEvaluation } from '../diagnostic-evaluations/entities/diagnostic-evaluation.entity';
import { Grade } from '../grades/entities/grade.entity';
import { GradesModule } from '../grades/grades.module';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { PromediosModule } from '../promedios/promedios.module';
import { StudentsModule } from '../students/students.module';
import { EvaluationReportJob } from './entities/evaluation-report-job.entity';
import { EvaluationReportsController } from './evaluation-reports.controller';
import { EvaluationReportsExportService } from './evaluation-reports-export.service';
import { EvaluationReportsJobService } from './evaluation-reports-job.service';
import { EvaluationReportsService } from './evaluation-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Institution,
      Grade,
      CompetencyEvaluation,
      DiagnosticEvaluation,
      CurriculumSubject,
      EvaluationReportJob,
    ]),
    GradesModule,
    PromediosModule,
    StudentsModule,
    MaestrosModule,
    AuditLogsModule,
  ],
  controllers: [EvaluationReportsController],
  providers: [
    EvaluationReportsService,
    EvaluationReportsExportService,
    EvaluationReportsJobService,
  ],
  exports: [EvaluationReportsService],
})
export class EvaluationReportsModule {}
