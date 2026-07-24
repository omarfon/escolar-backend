import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { GradingModule } from '../grading/grading.module';
import { Sede } from './entities/sede.entity';
import { EducationLevel } from './entities/education-level.entity';
import { GradeLevel } from './entities/grade-level.entity';
import { GradeSection } from './entities/grade-section.entity';
import { Institution } from './entities/institution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Sede, EducationLevel, GradeLevel, GradeSection]),
    forwardRef(() => GradingModule),
  ],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
