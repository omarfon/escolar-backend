import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { ConductIncidentsController } from './conduct-incidents.controller';
import { ConductIncidentsService } from './conduct-incidents.service';
import { ConductIncident } from './entities/conduct-incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ConductIncident, Student])],
  controllers: [ConductIncidentsController],
  providers: [ConductIncidentsService],
  exports: [ConductIncidentsService],
})
export class ConductIncidentsModule {}
