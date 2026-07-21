import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaestrosModule } from '../maestros/maestros.module';
import { MaestroCurso } from '../maestros/cursos/entities/maestro-curso.entity';
import { Salon } from '../maestros/salones/entities/salon.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { Curriculum } from './entities/curriculum.entity';
import { CurriculumArea } from './entities/curriculum-area.entity';
import { CurriculumSubject } from './entities/curriculum-subject.entity';
import { CurriculumCompetencia } from './entities/curriculum-competencia.entity';
import { CurriculumCapacidad } from './entities/curriculum-capacidad.entity';
import { CurriculumIndicador } from './entities/curriculum-indicador.entity';
import { CurriculumTeacherAssignment } from './entities/curriculum-teacher-assignment.entity';
import { CurriculaController } from './curricula.controller';
import { CurriculaService } from './curricula.service';

@Module({
  imports: [
    MaestrosModule,
    TypeOrmModule.forFeature([
      Curriculum,
      CurriculumArea,
      CurriculumSubject,
      CurriculumCompetencia,
      CurriculumCapacidad,
      CurriculumIndicador,
      CurriculumTeacherAssignment,
      MaestroCurso,
      Docente,
      Salon,
    ]),
  ],
  controllers: [CurriculaController],
  providers: [CurriculaService],
  exports: [CurriculaService],
})
export class CurriculaModule {}
