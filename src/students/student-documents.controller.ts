import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  UpdateDocumentoDto,
  UpsertDocumentoDto,
} from './dto/expediente.dto';
import { UploadStudentDocumentDto } from './dto/student-document-upload.dto';
import { StudentDocumentsService } from './student-documents.service';
import {
  PERMISO_DOCUMENTOS_CARGAR,
  PERMISO_DOCUMENTOS_DESCARGAR,
  PERMISO_DOCUMENTOS_VER,
} from './student-documents.constants';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

type AuthRequest = Request & { user?: RequestUser };

@Controller('students')
@RequirePermiso('estudiantes.ver')
export class StudentDocumentsController {
  constructor(
    private readonly studentDocumentsService: StudentDocumentsService,
  ) {}

  @Get('documents/context')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_VER,
    'estudiantes.ver',
    'estudiantes.expediente',
  )
  getDocumentsContext() {
    return this.studentDocumentsService.getContext();
  }

  @Get('document-requirements/:gradoLabel')
  getDocumentRequirements(@Param('gradoLabel') gradoLabel: string) {
    return this.studentDocumentsService.getRequisitosDocumentos(
      decodeURIComponent(gradoLabel),
    );
  }

  @Get(':id/documents')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_VER,
    'estudiantes.ver',
    'estudiantes.expediente',
  )
  findDocuments(@Param('id') id: string) {
    return this.studentDocumentsService.findStudentDocumentsMatricula(+id);
  }

  @Get(':id/documents/audit')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_VER,
    'estudiantes.expediente',
    'admin.reportes',
  )
  findDocumentAudit(
    @Param('id') id: string,
    @Query('documentId') documentId?: string,
  ) {
    return this.studentDocumentsService.findAuditLogs({
      studentId: +id,
      documentId: documentId ? +documentId : undefined,
    });
  }

  @Post(':id/documents/sync-requisitos')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_CARGAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  syncRequisitos(@Param('id') id: string) {
    return this.studentDocumentsService.syncRequisitosMatricula(+id);
  }

  @Post(':id/documents')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_CARGAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  addDocument(@Param('id') id: string, @Body() dto: UpsertDocumentoDto) {
    return this.studentDocumentsService.addDocument(+id, dto);
  }

  @Post(':id/documents/:docId/upload')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_CARGAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadStudentDocumentDto,
    @Req() req: AuthRequest,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo');
    }
    return this.studentDocumentsService.uploadFile(
      +id,
      +docId,
      file,
      dto,
      this.studentDocumentsService.auditContextFromRequest(req),
    );
  }

  @Get(':id/documents/:docId/versions')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_VER,
    'estudiantes.ver',
    'estudiantes.expediente',
  )
  listDocumentVersions(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.studentDocumentsService.listVersions(+id, +docId);
  }

  @Get(':id/documents/:docId/versions/:versionId/download')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_DESCARGAR,
    'estudiantes.ver',
    'estudiantes.expediente',
  )
  downloadDocumentVersion(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    return this.studentDocumentsService.streamDownload(
      +id,
      +docId,
      +versionId,
      res,
      this.studentDocumentsService.auditContextFromRequest(req),
    );
  }

  @Patch(':id/documents/:docId')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_CARGAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  updateDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentoDto,
  ) {
    return this.studentDocumentsService.updateDocument(+id, +docId, dto);
  }

  @Delete(':id/documents/:docId')
  @RequirePermiso(
    PERMISO_DOCUMENTOS_CARGAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  removeDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.studentDocumentsService.removeDocument(+id, +docId);
  }
}
