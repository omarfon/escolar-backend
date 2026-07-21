import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HorarioPeriodo } from './entities/horario-periodo.entity';
import { HorarioBlock } from './entities/horario-block.entity';
import { HorariosService } from './horarios.service';
import { HorariosController } from './horarios.controller';
import { CurriculaModule } from '../curricula/curricula.module';
import { AuthModule } from '../auth/auth.module';
import { Salon } from '../maestros/salones/entities/salon.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';

@Module({
  imports: [
    CurriculaModule,
    AuthModule,
    TypeOrmModule.forFeature([
      HorarioPeriodo,
      HorarioBlock,
      Salon,
      CurriculumTeacherAssignment,
      Docente,
    ]),
  ],
  controllers: [HorariosController],
  providers: [HorariosService],
  exports: [HorariosService],
})
export class HorariosModule {}
