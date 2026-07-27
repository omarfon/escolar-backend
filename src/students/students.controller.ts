import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
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
import { BulkImportHistorialDto } from './dto/bulk-import-historial.dto';
import { StudentsService } from './students.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

type AuthRequest = Request & { user?: RequestUser };

@Controller('students')
@RequirePermiso('estudiantes.ver')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @RequirePermiso('estudiantes.crear', 'matricula.crear')
  create(@Body() body: CreateExpedienteDto | CreateStudentDto) {
    if ('gradoLabel' in body || 'nombres' in body) {
      return this.studentsService.createExpediente(body as CreateExpedienteDto);
    }
    return this.studentsService
      .create(body as CreateStudentDto)
      .then((saved) => this.studentsService.findExpediente(saved.id));
  }

  @Post('bulk-matricula')
  @RequirePermiso('matricula.crear', 'estudiantes.crear')
  bulkMatricula(@Body() dto: BulkImportMatriculaDto) {
    return this.studentsService.bulkCreateMatriculas(dto.estudiantes);
  }

  @Post('bulk-matricula/preview')
  @RequirePermiso('matricula.crear', 'estudiantes.crear')
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
  @RequirePermiso('matricula.crear', 'estudiantes.crear')
  @UseInterceptors(FileInterceptor('file'))
  uploadBulkMatricula(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo CSV o Excel');
    }
    return this.studentsService.bulkCreateFromFile(file.buffer, file.originalname);
  }

  @Post('bulk-historial-academico')
  @RequirePermiso('estudiantes.editar', 'matricula.crear', 'matricula.ver')
  bulkHistorialAcademico(@Body() dto: BulkImportHistorialDto) {
    return this.studentsService.bulkImportHistorial(dto.filas);
  }

  @Post('bulk-historial-academico/preview')
  @RequirePermiso('estudiantes.editar', 'matricula.crear', 'matricula.ver', 'estudiantes.ver')
  @UseInterceptors(FileInterceptor('file'))
  previewBulkHistorial(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo CSV o Excel');
    }
    return this.studentsService.previewBulkHistorialFromFile(
      file.buffer,
      file.originalname,
    );
  }

  @Post('bulk-historial-academico/upload')
  @RequirePermiso('estudiantes.editar', 'matricula.crear', 'matricula.ver')
  @UseInterceptors(FileInterceptor('file'))
  uploadBulkHistorial(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe enviar un archivo CSV o Excel');
    }
    return this.studentsService.bulkImportHistorialFromFile(
      file.buffer,
      file.originalname,
    );
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
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.studentsService.getSectionOccupancy(
      nivel,
      grado,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Get('section-change-candidates')
  findSectionChangeCandidates(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
  ) {
    return this.studentsService.findSectionChangeCandidates(nivel, grado);
  }

  @Get('document-requirements/:gradoLabel')
  getDocumentRequirements(@Param('gradoLabel') gradoLabel: string) {
    return this.studentsService.getRequisitosDocumentos(
      decodeURIComponent(gradoLabel),
    );
  }

  @Get('me')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE', 'ADMIN')
  findMe(@Req() req: AuthRequest) {
    const login = req.user?.username ?? '';
    return this.studentsService.findMeByLogin(login);
  }

  @Get('me/profile')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE', 'ADMIN')
  findMeProfile(@Req() req: AuthRequest) {
    const login = req.user?.username ?? '';
    return this.studentsService.findMeProfileByLogin(login);
  }

  @Get('me/contactos')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE', 'ADMIN')
  findMeContactos(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const login = req.user?.username ?? '';
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.studentsService.findContactosByLogin(login, anio);
  }

  @Get('me/attendance')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE', 'ADMIN')
  findMeAttendance(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const login = req.user?.username ?? '';
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.studentsService.findAttendancesByLogin(login, anio);
  }

  @Get('me/grades')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE', 'ADMIN')
  findMeGrades(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const login = req.user?.username ?? '';
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.studentsService.findGradesByLogin(login, anio);
  }

  @Get()
  findAll(@Query('q') q?: string) {
    return this.studentsService.findAllExpedientes(q);
  }

  @Get('stats')
  getStats() {
    return this.studentsService.getStudentsStats();
  }

  @Get('export')
  @RequirePermiso('estudiantes.exportar', 'estudiantes.ver')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportExpedientes(
    @Query('q') q?: string,
    @Query('grado') grado?: string,
    @Query('estado') estado?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.studentsService.exportExpedientesCsv({
      q,
      grado,
      estado,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="padron-estudiantes-${stamp}.csv"`,
    );
    res!.send(`\uFEFF${csv}`);
  }

  @Get('historial-academico')
  findHistorialAcademicoList(@Query('q') q?: string) {
    return this.studentsService.findHistorialAcademicoList(q);
  }

  @Get(':id/historial-academico')
  findHistorialAcademicoDetalle(@Param('id') id: string) {
    return this.studentsService.findHistorialAcademicoDetalle(+id);
  }

  @Get(':id/expediente')
  @RequirePermiso('estudiantes.expediente', 'estudiantes.ver')
  findExpediente(@Param('id') id: string) {
    return this.studentsService.findExpediente(+id);
  }

  @Get(':id/documents')
  findDocuments(@Param('id') id: string) {
    return this.studentsService.findStudentDocumentsMatricula(+id);
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
  @RequirePermiso('estudiantes.editar', 'matricula.editar')
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
  @RequirePermiso('estudiantes.eliminar', 'matricula.anular')
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
