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
import { esSuperusuarioSiagie, institutionIdDeAlcance } from '../auth/siagie-access.util';
import { ChangeSectionDto } from './dto/change-section.dto';
import { CreateSectionChangeRequestDto } from './dto/section-change-request.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import {
  CreateExpedienteDto,
  UpdateExpedienteDto,
} from './dto/expediente.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BulkImportMatriculaDto } from './dto/bulk-import-students.dto';
import { BulkImportHistorialDto } from './dto/bulk-import-historial.dto';
import {
  CheckSinDocumentoDuplicatesDto,
  CreateSinDocumentoDto,
  RegularizarDocumentoDto,
} from './dto/student-sin-documento.dto';
import {
  CreateStudentWithdrawalDto,
} from './dto/student-withdrawal.dto';
import {
  CreateStudentReadmissionDto,
} from './dto/student-readmission.dto';
import { StudentsService } from './students.service';
import { StudentChangeAuditService } from './student-change-audit.service';
import { StudentSensitiveNotificationService } from './student-sensitive-notification.service';
import { StudentWithdrawalService } from './student-withdrawal.service';
import { StudentReadmissionService } from './student-readmission.service';
import { StudentExceptionalEnrollmentService } from './student-exceptional-enrollment.service';
import {
  CheckExceptionalEnrollmentAgeDto,
  CheckExceptionalEnrollmentDuplicatesDto,
  CreateExceptionalEnrollmentDto,
} from './dto/student-exceptional-enrollment.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

type AuthRequest = Request & { user?: RequestUser };

@Controller('students')
@RequirePermiso('estudiantes.ver')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentChangeAudit: StudentChangeAuditService,
    private readonly sensitiveNotification: StudentSensitiveNotificationService,
    private readonly studentWithdrawal: StudentWithdrawalService,
    private readonly studentReadmission: StudentReadmissionService,
    private readonly exceptionalEnrollment: StudentExceptionalEnrollmentService,
  ) {}

  @Post()
  @RequirePermiso('estudiantes.crear', 'matricula.crear')
  create(
    @Body() body: CreateExpedienteDto | CreateStudentDto,
    @Req() req: AuthRequest,
  ) {
    if ('gradoLabel' in body || 'nombres' in body) {
      return this.studentsService.createExpediente(body as CreateExpedienteDto, {
        req,
        motivo: 'Registro de expediente',
      });
    }
    return this.studentsService
      .create(body as CreateStudentDto)
      .then((saved) => this.studentsService.findExpediente(saved.id));
  }

  @Get('sin-documento/context')
  @RequirePermiso('estudiantes.crear', 'matricula.crear')
  getSinDocumentoContext() {
    return this.studentsService.getSinDocumentoContext();
  }

  @Post('sin-documento/check-duplicates')
  @RequirePermiso('estudiantes.crear', 'matricula.crear')
  checkSinDocumentoDuplicates(@Body() dto: CheckSinDocumentoDuplicatesDto) {
    return this.studentsService.findSinDocumentoDuplicates(dto);
  }

  @Post('sin-documento')
  @RequirePermiso('estudiantes.crear', 'matricula.crear')
  createSinDocumento(
    @Body() dto: CreateSinDocumentoDto,
    @Req() req: AuthRequest,
  ) {
    return this.studentsService.createExpedienteSinDocumento(dto, {
      req,
      motivo: dto.sinDocumentoMotivo,
    });
  }

  @Get('matricula-excepcional/context')
  @RequirePermiso('matricula.excepcional', 'matricula.crear')
  getExceptionalEnrollmentContext(@Req() req: AuthRequest) {
    this.exceptionalEnrollment.logConsultation(req, 'contexto');
    return this.exceptionalEnrollment.getContext();
  }

  @Post('matricula-excepcional/check-age')
  @RequirePermiso('matricula.excepcional', 'matricula.crear')
  checkExceptionalEnrollmentAge(@Body() dto: CheckExceptionalEnrollmentAgeDto) {
    return this.exceptionalEnrollment.checkAge(dto);
  }

  @Post('matricula-excepcional/check-duplicates')
  @RequirePermiso('matricula.excepcional', 'matricula.crear')
  checkExceptionalEnrollmentDuplicates(
    @Body() dto: CheckExceptionalEnrollmentDuplicatesDto,
  ) {
    return this.exceptionalEnrollment.findDuplicates(dto);
  }

  @Post('matricula-excepcional')
  @RequirePermiso('matricula.excepcional', 'matricula.crear')
  createExceptionalEnrollment(
    @Body() dto: CreateExceptionalEnrollmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.exceptionalEnrollment.register(dto, {
      req,
      motivo: dto.excepcionalMotivo,
    });
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
    @Req() req?: AuthRequest,
  ) {
    return this.studentsService.findSectionChangeCandidates(
      nivel,
      grado,
      institutionIdDeAlcance(req?.user, req),
    );
  }

  @Get('section-change-requests')
  findSectionChangeRequests(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
  ) {
    return this.studentsService.findSectionChangeRequests(nivel, grado);
  }

  @Post('section-change-requests')
  createSectionChangeRequest(@Body() dto: CreateSectionChangeRequestDto) {
    return this.studentsService.createSectionChangeRequest(dto);
  }

  @Patch('section-change-requests/:id/cancel')
  cancelSectionChangeRequest(@Param('id') id: string) {
    return this.studentsService.cancelSectionChangeRequest(+id);
  }

  @Post('section-change-requests/:id/process')
  processSectionChangeRequest(
    @Param('id') id: string,
    @Body() body: { nuevaSeccion?: string },
  ) {
    return this.studentsService.processSectionChangeRequest(+id, body?.nuevaSeccion);
  }

  @Get('me')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
  findMe(@Req() req: AuthRequest) {
    const login = req.user?.username ?? '';
    return this.studentsService.findMeByLogin(login);
  }

  @Get('me/profile')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
  findMeProfile(@Req() req: AuthRequest) {
    const login = req.user?.username ?? '';
    return this.studentsService.findMeProfileByLogin(login);
  }

  @Get('me/contactos')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
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
  @RequireRole('ESTUDIANTE')
  findMeAttendance(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const login = req.user?.username ?? '';
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.studentsService.findAttendancesByLogin(login, anio);
  }

  @Get('me/conduct')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
  findMeConduct(@Req() req: AuthRequest) {
    const login = req.user?.username ?? '';
    return this.studentsService.findMeConductByLogin(login);
  }

  @Get('me/grades')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
  findMeGrades(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const login = req.user?.username ?? '';
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.studentsService.findGradesByLogin(login, anio);
  }

  @Get('matricula-nacional')
  findMatriculaNacional(@Query('q') q = '') {
    return this.studentsService.findMatriculaNacional(q);
  }

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('grado') grado?: string,
    @Query('estado') estado?: string,
    @Query('estadoDocumento') estadoDocumento?: string,
  ) {
    const institutionId = this.resolveInstitutionScope(req);
    const pageNum = page ? +page : 1;
    const pageSizeNum = pageSize ? +pageSize : 20;
    if (esSuperusuarioSiagie(req.user) && institutionId === undefined) {
      return { items: [], total: 0, page: pageNum, pageSize: pageSizeNum };
    }
    return this.studentsService.findExpedientesPage({
      q,
      page: pageNum,
      pageSize: pageSizeNum,
      grado,
      estado,
      estadoDocumento,
      institutionId,
    });
  }

  @Get('stats')
  getStats(@Req() req: AuthRequest) {
    const institutionId = this.resolveInstitutionScope(req);
    if (esSuperusuarioSiagie(req.user) && institutionId === undefined) {
      return {
        total: 0,
        activos: 0,
        inactivos: 0,
        retirados: 0,
        matriculadosActivos: 0,
        mujeres: 0,
        varones: 0,
      };
    }
    return this.studentsService.getStudentsStats(institutionId);
  }

  @Get('export')
  @RequirePermiso('estudiantes.exportar', 'estudiantes.ver')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportExpedientes(
    @Query('q') q?: string,
    @Query('grado') grado?: string,
    @Query('estado') estado?: string,
    @Query('estadoDocumento') estadoDocumento?: string,
    @Req() req?: AuthRequest,
    @Res() res?: Response,
  ) {
    const csv = await this.studentsService.exportExpedientesCsv({
      q,
      grado,
      estado,
      estadoDocumento,
      institutionId: req ? this.resolveInstitutionScope(req) : undefined,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="padron-estudiantes-${stamp}.csv"`,
    );
    res!.send(`\uFEFF${csv}`);
  }

  @Get('historial-academico')
  findHistorialAcademicoList(
    @Req() req: AuthRequest,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const institutionId = this.resolveInstitutionScope(req);
    const pageNum = page ? +page : 1;
    const pageSizeNum = pageSize ? +pageSize : 20;
    if (esSuperusuarioSiagie(req.user) && institutionId === undefined) {
      return { items: [], total: 0, page: pageNum, pageSize: pageSizeNum };
    }
    return this.studentsService.findHistorialAcademicoPage(
      q,
      pageNum,
      pageSizeNum,
      institutionId,
    );
  }

  /**
   * OpenAPI: GET /students/withdrawals/context
   * Contexto institucional y catálogo de motivos para registrar retiro.
   */
  @Get('withdrawals/context')
  @RequirePermiso('matricula.ver', 'matricula.retiro', 'matricula.exportar')
  getWithdrawalContext() {
    return this.studentWithdrawal.getContext();
  }

  /**
   * OpenAPI: GET /students/withdrawals
   * Listado paginado de retiros registrados.
   */
  @Get('withdrawals')
  @RequirePermiso('matricula.ver', 'matricula.retiro', 'matricula.exportar')
  findWithdrawals(
    @Query('studentId') studentId?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Query('busqueda') busqueda?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.studentWithdrawal.findAll({
      studentId: studentId ? +studentId : undefined,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      busqueda,
      desde,
      hasta,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  /**
   * OpenAPI: GET /students/withdrawals/:id
   */
  @Get('withdrawals/:id')
  @RequirePermiso('matricula.ver', 'matricula.retiro', 'matricula.exportar')
  findWithdrawal(@Param('id') id: string) {
    return this.studentWithdrawal.findOne(+id);
  }

  /**
   * OpenAPI: GET /students/readmissions/context
   * Contexto institucional y catálogo de motivos para registrar reingreso.
   */
  @Get('readmissions/context')
  @RequirePermiso('matricula.ver', 'matricula.reingreso', 'matricula.exportar')
  getReadmissionContext() {
    return this.studentReadmission.getContext();
  }

  /**
   * OpenAPI: GET /students/readmissions
   * Listado paginado de reingresos registrados.
   */
  @Get('readmissions')
  @RequirePermiso('matricula.ver', 'matricula.reingreso', 'matricula.exportar')
  findReadmissions(
    @Query('studentId') studentId?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Query('busqueda') busqueda?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.studentReadmission.findAll({
      studentId: studentId ? +studentId : undefined,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      busqueda,
      desde,
      hasta,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  /**
   * OpenAPI: GET /students/readmissions/:id
   */
  @Get('readmissions/:id')
  @RequirePermiso('matricula.ver', 'matricula.reingreso', 'matricula.exportar')
  findReadmission(@Param('id') id: string) {
    return this.studentReadmission.findOne(+id);
  }

  @Get('sensitive-notifications/context')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  getSensitiveNotificationsContext(@Req() req: AuthRequest) {
    this.sensitiveNotification.logConsultation(req, 'listar');
    return this.sensitiveNotification.getContext();
  }

  @Get('sensitive-notifications')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  findSensitiveNotifications(
    @Req() req: AuthRequest,
    @Query('studentId') studentId?: string,
    @Query('correoEnviado') correoEnviado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.sensitiveNotification.logConsultation(req, 'listar');
    return this.sensitiveNotification.findAll({
      studentId: studentId ? +studentId : undefined,
      correoEnviado,
      desde,
      hasta,
      busqueda,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('sensitive-notifications/:notifId')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  findSensitiveNotificationOne(
    @Req() req: AuthRequest,
    @Param('notifId') notifId: string,
  ) {
    this.sensitiveNotification.logConsultation(req, 'detalle', notifId);
    return this.sensitiveNotification.findOne(+notifId);
  }

  @Get('change-audit/context')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  getChangeAuditContext() {
    return this.studentChangeAudit.getContext();
  }

  @Get('change-audit/export')
  @RequirePermiso('estudiantes.exportar', 'admin.reportes')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="auditoria_estudiantes.csv"',
  )
  exportChangeAuditCsv(
    @Query('studentId') studentId?: string,
    @Query('accion') accion?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('resultado') resultado?: string,
  ) {
    return this.studentChangeAudit.exportCsv({
      studentId: studentId ? +studentId : undefined,
      accion,
      usuario,
      desde,
      hasta,
      busqueda,
      resultado,
    });
  }

  @Get('change-audit')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  findChangeAudit(
    @Query('studentId') studentId?: string,
    @Query('accion') accion?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('resultado') resultado?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.studentChangeAudit.findAll({
      studentId: studentId ? +studentId : undefined,
      accion,
      usuario,
      desde,
      hasta,
      busqueda,
      resultado,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('change-audit/:logId')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  findChangeAuditOne(@Param('logId') logId: string) {
    return this.studentChangeAudit.findOne(+logId);
  }

  @Get(':id/historial-academico')
  findHistorialAcademicoDetalle(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.studentsService.findHistorialAcademicoDetalle(+id, req.user);
  }

  @Get(':id/change-audit')
  @RequirePermiso('estudiantes.expediente', 'admin.reportes')
  findStudentChangeAudit(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.studentsService.findStudentChangeAudit(
      +id,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get(':id/expediente')
  @RequirePermiso('estudiantes.expediente', 'estudiantes.ver')
  findExpediente(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.studentsService.findExpediente(+id, req.user);
  }

  /**
   * OpenAPI: GET /students/:id/withdrawal-eligibility
   */
  @Get(':id/withdrawal-eligibility')
  @RequirePermiso('matricula.ver', 'matricula.retiro', 'matricula.exportar')
  getWithdrawalEligibility(@Param('id') id: string) {
    return this.studentWithdrawal.getEligibility(+id);
  }

  /**
   * OpenAPI: GET /students/:id/readmission-eligibility
   */
  @Get(':id/readmission-eligibility')
  @RequirePermiso('matricula.ver', 'matricula.reingreso', 'matricula.exportar')
  getReadmissionEligibility(@Param('id') id: string) {
    return this.studentReadmission.getEligibility(+id);
  }

  /**
   * OpenAPI: POST /students/:id/withdrawals
   * Idempotente vía header Idempotency-Key / X-Correlation-Id.
   */
  @Post(':id/withdrawals')
  @RequirePermiso('matricula.retiro')
  registerWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateStudentWithdrawalDto,
    @Req() req: AuthRequest,
  ) {
    return this.studentWithdrawal.register(+id, dto, req);
  }

  /**
   * OpenAPI: POST /students/:id/readmissions
   * Idempotente vía header Idempotency-Key / X-Correlation-Id.
   */
  @Post(':id/readmissions')
  @RequirePermiso('matricula.reingreso')
  registerReadmission(
    @Param('id') id: string,
    @Body() dto: CreateStudentReadmissionDto,
    @Req() req: AuthRequest,
  ) {
    return this.studentReadmission.register(+id, dto, req);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.studentsService.findExpediente(+id, req.user);
  }

  @Post(':id/change-section')
  changeSection(
    @Param('id') id: string,
    @Body() dto: ChangeSectionDto,
    @Req() req: AuthRequest,
  ) {
    return this.studentsService.changeSection(+id, dto, { req, motivo: dto.motivo });
  }

  @Patch(':id/regularizar-documento')
  @RequirePermiso('estudiantes.editar', 'matricula.editar')
  regularizarDocumento(
    @Param('id') id: string,
    @Body() dto: RegularizarDocumentoDto,
    @Req() req: AuthRequest,
  ) {
    return this.studentsService.regularizarDocumento(+id, dto, {
      req,
      motivo: dto.auditMotivo,
    });
  }

  @Patch(':id')
  @RequirePermiso('estudiantes.editar', 'matricula.editar')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExpedienteDto | UpdateStudentDto,
    @Req() req: AuthRequest,
  ) {
    if (
      'nombres' in body ||
      'apellidos' in body ||
      'gradoLabel' in body ||
      'documentos' in body ||
      'historialAcademico' in body ||
      'padre' in body
    ) {
      const dto = body as UpdateExpedienteDto;
      return this.studentsService.updateExpediente(+id, dto, {
        req,
        motivo: dto.auditMotivo,
      });
    }
    const simple = body as UpdateStudentDto & { auditMotivo?: string };
    return this.studentsService.update(+id, body as UpdateStudentDto, {
      req,
      motivo: simple.auditMotivo?.trim(),
    });
  }

  @Delete(':id')
  @RequirePermiso('estudiantes.eliminar', 'matricula.anular')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.studentsService.remove(+id, {
      req,
      motivo: 'Eliminación de estudiante',
    });
  }

  /** IE activa: ignora valores inválidos (-1, 0). */
  private resolveInstitutionScope(req: AuthRequest): number | undefined {
    const raw = institutionIdDeAlcance(req.user, req);
    return raw != null && raw > 0 ? raw : undefined;
  }

}
