import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChangeSectionDto } from './dto/change-section.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import {
  CreateExpedienteDto,
  UpdateDocumentoDto,
  UpdateExpedienteDto,
  UpsertDocumentoDto,
} from './dto/expediente.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BulkImportMatriculaDto } from './dto/bulk-import-students.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(@Body() body: CreateExpedienteDto | CreateStudentDto) {
    if ('gradoLabel' in body || 'nombres' in body) {
      return this.studentsService.createExpediente(body as CreateExpedienteDto);
    }
    return this.studentsService
      .create(body as CreateStudentDto)
      .then((saved) => this.studentsService.findExpediente(saved.id));
  }

  @Post('bulk-matricula')
  bulkMatricula(@Body() dto: BulkImportMatriculaDto) {
    return this.studentsService.bulkCreateMatriculas(dto.estudiantes);
  }

  @Post('bulk-matricula/preview')
  @UseInterceptors(FileInterceptor('file'))
  previewBulkMatricula(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo CSV o Excel');
    }
    return this.studentsService.previewBulkFromFile(
      file.buffer,
      file.originalname,
    );
  }

  @Post('bulk-matricula/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadBulkMatricula(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo CSV o Excel');
    }
    return this.studentsService.bulkCreateFromFile(file.buffer, file.originalname);
  }

  @Get('section-changes')
  findSectionChanges(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
  ) {
    return this.studentsService.findSectionChanges(nivel, grado);
  }

  @Get('section-occupancy')
  getSectionOccupancy(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
  ) {
    return this.studentsService.getSectionOccupancy(nivel, grado);
  }

  @Get('document-requirements/:gradoLabel')
  getDocumentRequirements(@Param('gradoLabel') gradoLabel: string) {
    return this.studentsService.getRequisitosDocumentos(
      decodeURIComponent(gradoLabel),
    );
  }

  @Get()
  findAll(@Query('q') q?: string) {
    return this.studentsService.findAllExpedientes(q);
  }

  @Get(':id/expediente')
  findExpediente(@Param('id') id: string) {
    return this.studentsService.findExpediente(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findExpediente(+id);
  }

  @Post(':id/change-section')
  changeSection(@Param('id') id: string, @Body() dto: ChangeSectionDto) {
    return this.studentsService.changeSection(+id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExpedienteDto | UpdateStudentDto,
  ) {
    if (
      'nombres' in body ||
      'apellidos' in body ||
      'gradoLabel' in body ||
      'documentos' in body ||
      'historialAcademico' in body ||
      'padre' in body
    ) {
      return this.studentsService.updateExpediente(+id, body as UpdateExpedienteDto);
    }
    return this.studentsService.update(+id, body as UpdateStudentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentsService.remove(+id);
  }

  @Post(':id/documents/sync-requisitos')
  syncRequisitos(@Param('id') id: string) {
    return this.studentsService.syncRequisitosMatricula(+id);
  }

  @Post(':id/documents')
  addDocument(
    @Param('id') id: string,
    @Body() dto: UpsertDocumentoDto,
  ) {
    return this.studentsService.addDocument(+id, dto);
  }

  @Patch(':id/documents/:docId')
  updateDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentoDto,
  ) {
    return this.studentsService.updateDocument(+id, +docId, dto);
  }

  @Delete(':id/documents/:docId')
  removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.studentsService.removeDocument(+id, +docId);
  }
}
