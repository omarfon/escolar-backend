import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grade } from '../grades/entities/grade.entity';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { ActasController } from './actas.controller';
import { ActasService } from './actas.service';
import { EvaluationActa } from './entities/evaluation-acta.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvaluationActa, Grade]),
    StudentsModule,
    MaestrosModule,
  ],
  controllers: [ActasController],
  providers: [ActasService],
  exports: [ActasService],
})
export class ActasModule {}
