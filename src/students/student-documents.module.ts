import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Institution } from '../institution/entities/institution.entity';
import { StudentDocumentAuditLog } from './entities/student-document-audit-log.entity';
import { StudentDocumentVersion } from './entities/student-document-version.entity';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from './entities/student.entity';
import { StudentDocumentsController } from './student-documents.controller';
import { StudentDocumentsService } from './student-documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentDocument,
      StudentDocumentVersion,
      StudentDocumentAuditLog,
      Student,
      Institution,
    ]),
    AuditLogsModule,
  ],
  controllers: [StudentDocumentsController],
  providers: [StudentDocumentsService],
  exports: [StudentDocumentsService],
})
export class StudentDocumentsModule {}
