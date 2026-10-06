import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Institution } from '../institution/entities/institution.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { Student } from '../students/entities/student.entity';
import { RepresentativeLinkLog } from './entities/representative-link-log.entity';
import { RepresentativeStudentLink } from './entities/representative-student-link.entity';
import { Representative } from './entities/representative.entity';
import { RepresentativeLinksController } from './representative-links.controller';
import { RepresentativeLinksService } from './representative-links.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Representative,
      RepresentativeStudentLink,
      RepresentativeLinkLog,
      Student,
      ParentStudent,
      Institution,
    ]),
    AuditLogsModule,
  ],
  controllers: [RepresentativeLinksController],
  providers: [RepresentativeLinksService],
  exports: [RepresentativeLinksService],
})
export class RepresentativeLinksModule {}
