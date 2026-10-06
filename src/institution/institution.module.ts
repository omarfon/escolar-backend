import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { GradingModule } from '../grading/grading.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { Sede } from './entities/sede.entity';
import { EducationLevel } from './entities/education-level.entity';
import { GradeLevel } from './entities/grade-level.entity';
import { GradeSection } from './entities/grade-section.entity';
import { Institution } from './entities/institution.entity';
import { InstitutionDirectoryController } from './institution-directory.controller';
import { InstitutionDirectoryService } from './institution-directory.service';
import { Student } from '../students/entities/student.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { TransferRequest } from '../transfers/entities/transfer-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Institution,
      Sede,
      EducationLevel,
      GradeLevel,
      GradeSection,
      Student,
      StudentAcademicHistory,
      TransferRequest,
    ]),
    forwardRef(() => GradingModule),
    forwardRef(() => MaestrosModule),
  ],
  controllers: [InstitutionController, InstitutionDirectoryController],
  providers: [InstitutionService, InstitutionDirectoryService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
