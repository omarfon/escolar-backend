import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { Sede } from './entities/sede.entity';
import { EducationLevel } from './entities/education-level.entity';
import { GradeLevel } from './entities/grade-level.entity';
import { GradeSection } from './entities/grade-section.entity';
import { Institution } from './entities/institution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Institution, Sede, EducationLevel, GradeLevel, GradeSection])],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
