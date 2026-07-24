import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradingModule } from '../grading/grading.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { StudentsModule } from '../students/students.module';
import { Promedio } from './entities/promedio.entity';
import { PromediosService } from './promedios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promedio]),
    StudentsModule,
    GradingModule,
    MaestrosModule,
  ],
  providers: [PromediosService],
  exports: [PromediosService],
})
export class PromediosModule {}
