import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { GradingModule } from '../grading/grading.module';
import { PromediosModule } from '../promedios/promedios.module';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { Grade } from './entities/grade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grade]),
    StudentsModule,
    MaestrosModule,
    GradingModule,
    PromediosModule,
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
