import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { Institution } from '../institution/entities/institution.entity';
import { GradingModule } from '../grading/grading.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { DiagnosticChangeAuditService } from './diagnostic-change-audit.service';
import { DiagnosticChangeLog } from './entities/diagnostic-change-log.entity';
import { DiagnosticEvaluation } from './entities/diagnostic-evaluation.entity';
import { DiagnosticEvaluationsController } from './diagnostic-evaluations.controller';
import { DiagnosticEvaluationsService } from './diagnostic-evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiagnosticEvaluation,
      DiagnosticChangeLog,
      EvaluationActa,
      Institution,
    ]),
    StudentsModule,
    MaestrosModule,
    GradingModule,
    AuditLogsModule,
  ],
  controllers: [DiagnosticEvaluationsController],
  providers: [DiagnosticEvaluationsService, DiagnosticChangeAuditService],
  exports: [DiagnosticEvaluationsService, DiagnosticChangeAuditService],
})
export class DiagnosticEvaluationsModule {}
