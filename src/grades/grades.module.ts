import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { Institution } from '../institution/entities/institution.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { GradingModule } from '../grading/grading.module';
import { PromediosModule } from '../promedios/promedios.module';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { GradeChangeAuditService } from './grade-change-audit.service';
import { GradeChangeLog } from './entities/grade-change-log.entity';
import { Grade } from './entities/grade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grade, GradeChangeLog, Institution, EvaluationActa]),
    StudentsModule,
    MaestrosModule,
    GradingModule,
    PromediosModule,
    AuditLogsModule,
  ],
  controllers: [GradesController],
  providers: [GradesService, GradeChangeAuditService],
  exports: [GradesService, GradeChangeAuditService],
})
export class GradesModule {}
