import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetencyEvaluationsModule } from '../competency-evaluations/competency-evaluations.module';
import { CompetencyEvaluation } from '../competency-evaluations/entities/competency-evaluation.entity';
import { Student } from '../students/entities/student.entity';
import { InstitutionModule } from '../institution/institution.module';
import { ReportCard } from './entities/report-card.entity';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsPdfService } from './report-cards-pdf.service';
import { ReportCardsService } from './report-cards.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportCard, CompetencyEvaluation, Student]),
    CompetencyEvaluationsModule,
    InstitutionModule,
  ],
  controllers: [ReportCardsController],
  providers: [ReportCardsService, ReportCardsPdfService],
  exports: [ReportCardsService],
})
export class ReportCardsModule {}
