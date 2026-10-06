import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { Institution } from '../institution/entities/institution.entity';

import { Attendance } from '../attendances/entities/attendance.entity';

import { Grade } from '../grades/entities/grade.entity';

import { Schedule } from '../schedules/entities/schedule.entity';

import { SectionChange } from './entities/section-change.entity';

import { StudentAcademicHistory } from './entities/student-academic-history.entity';

import { Student } from './entities/student.entity';

import { StudentChangeLog } from './entities/student-change-log.entity';

import { StudentSensitiveNotification } from './entities/student-sensitive-notification.entity';

import { StudentWithdrawal } from './entities/student-withdrawal.entity';

import { StudentReadmission } from './entities/student-readmission.entity';

import { StudentChangeAuditService } from './student-change-audit.service';

import { StudentDocumentsModule } from './student-documents.module';

import { StudentSensitiveNotificationService } from './student-sensitive-notification.service';

import { StudentWithdrawalService } from './student-withdrawal.service';

import { StudentReadmissionService } from './student-readmission.service';

import { StudentExceptionalEnrollmentService } from './student-exceptional-enrollment.service';

import { StudentsController } from './students.controller';

import { StudentsService } from './students.service';

import { MaestrosModule } from '../maestros/maestros.module';

import { ConductIncidentsModule } from '../conduct-incidents/conduct-incidents.module';

import { HorarioBlock } from '../horarios/entities/horario-block.entity';

import { Docente } from '../maestros/docentes/entities/docente.entity';

import { CurriculumArea } from '../curricula/entities/curriculum-area.entity';

import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';

import { User } from '../users/entities/user.entity';



@Module({

  imports: [

    StudentDocumentsModule,

    TypeOrmModule.forFeature([

      Student,

      SectionChange,

      Schedule,

      StudentAcademicHistory,

      Attendance,

      Grade,

      HorarioBlock,

      Docente,

      CurriculumArea,

      CurriculumSubject,

      User,

      StudentChangeLog,

      StudentSensitiveNotification,

      StudentWithdrawal,

      StudentReadmission,

      Institution,

    ]),

    MaestrosModule,

    ConductIncidentsModule,

    AuditLogsModule,

  ],

  controllers: [StudentsController],

  providers: [

    StudentsService,

    StudentChangeAuditService,

    StudentSensitiveNotificationService,

    StudentWithdrawalService,

    StudentReadmissionService,

    StudentExceptionalEnrollmentService,

  ],

  exports: [

    StudentsService,

    StudentDocumentsModule,

    StudentChangeAuditService,

    StudentSensitiveNotificationService,

    StudentWithdrawalService,

    StudentReadmissionService,

    StudentExceptionalEnrollmentService,

  ],

})

export class StudentsModule {}

