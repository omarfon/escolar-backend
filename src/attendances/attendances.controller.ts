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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttendancesService } from './attendances.service';
import { AttendanceRecurrentAlertsService } from './attendance-recurrent-alerts.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateJustificationDto } from './dto/justification.dto';
import { UpdateAlertSettingsDto } from './dto/alert-settings.dto';
import { NotifyApoderadoDto } from './dto/notify-apoderado.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { SaveDailyRegisterDto } from './dto/daily-register.dto';
import {
  CloseRecurrentAlertDto,
  RecurrentAlertActionDto,
  ScanRecurrentAlertsDto,
} from './dto/recurrent-alert.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';

type AuthRequest = { user?: RequestUser };

@Controller('attendances')
@RequirePermiso('asistencia.ver')
export class AttendancesController {
  constructor(
    private readonly attendancesService: AttendancesService,
    private readonly recurrentAlertsService: AttendanceRecurrentAlertsService,
  ) {}

  @Get('control-report/export')
  @RequirePermiso('asistencia.exportar', 'asistencia.reportes')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportControlReport(
    @Query('mes') mes?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: AuthRequest,
    @Res() res?: Response,
  ) {
    const report = await this.attendancesService.getControlReport({
      mes,
      nivel,
      grado,
      seccion,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
    const csv = this.attendancesService.buildControlReportCsv(report);
    const filename = `control-faltas-${report.mes}.csv`;
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res!.send(`\uFEFF${csv}`);
  }

  @Get('control-report')
  @RequirePermiso('asistencia.reportes', 'asistencia.ver')
  getControlReport(
    @Query('mes') mes?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.getControlReport({
      mes,
      nivel,
      grado,
      seccion,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get('daily-register/calendar')
  getDailyRegisterCalendar(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('mes') mes: string,
    @Query('fecha') fecha?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.getDailyRegisterCalendar({
      nivel,
      grado,
      seccion,
      mes,
      fecha,
    }, institutionIdDeAlcance(req?.user, req));
  }

  @Get('daily-register')
  getDailyRegister(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('fecha') fecha: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.getDailyRegister({
      nivel,
      grado,
      seccion,
      fecha,
    }, institutionIdDeAlcance(req?.user, req));
  }

  @Post('daily-register')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  async saveDailyRegister(@Body() dto: SaveDailyRegisterDto, @Req() req: AuthRequest) {
    const institutionId = institutionIdDeAlcance(req.user, req);
    const result = await this.attendancesService.saveDailyRegister(dto, institutionId);
    void this.recurrentAlertsService
      .syncAfterDailyRegister(institutionId, result.fecha.slice(0, 7), req.user)
      .catch(() => undefined);
    return result;
  }

  @Get('recurrent-alerts/context')
  @RequirePermiso('asistencia.ver', 'asistencia.reportes')
  getRecurrentAlertsContext(@Req() req: AuthRequest) {
    return this.recurrentAlertsService.getContext(req.user, req as never);
  }

  @Get('recurrent-alerts')
  @RequirePermiso('asistencia.ver', 'asistencia.reportes')
  listRecurrentAlerts(
    @Query('mes') mes?: string,
    @Query('estado') estado?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.recurrentAlertsService.listAlerts({
      institutionId: institutionIdDeAlcance(req?.user, req),
      mes,
      estado,
      nivel,
      grado,
      busqueda,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Post('recurrent-alerts/scan')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  scanRecurrentAlerts(@Body() dto: ScanRecurrentAlertsDto, @Req() req: AuthRequest) {
    return this.recurrentAlertsService.scanAndSync({
      institutionId: institutionIdDeAlcance(req.user, req),
      mes: dto.mes,
      nivel: dto.nivel,
      grado: dto.grado,
      actor: req.user,
    });
  }

  @Get('recurrent-alerts/:id/actions')
  @RequirePermiso('asistencia.ver', 'asistencia.reportes')
  getRecurrentAlertActions(@Param('id') id: string, @Req() req?: AuthRequest) {
    return this.recurrentAlertsService.getActions(
      +id,
      institutionIdDeAlcance(req?.user, req),
    );
  }

  @Post('recurrent-alerts/:id/atender')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  atenderRecurrentAlert(
    @Param('id') id: string,
    @Body() dto: RecurrentAlertActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.recurrentAlertsService.atender(
      +id,
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Post('recurrent-alerts/:id/derivar')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  derivarRecurrentAlert(
    @Param('id') id: string,
    @Body() dto: RecurrentAlertActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.recurrentAlertsService.derivar(
      +id,
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Post('recurrent-alerts/:id/cerrar')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  cerrarRecurrentAlert(
    @Param('id') id: string,
    @Body() dto: CloseRecurrentAlertDto,
    @Req() req: AuthRequest,
  ) {
    return this.recurrentAlertsService.cerrar(
      +id,
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Post('recurrent-alerts/:id/justificar')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  justificarRecurrentAlert(
    @Param('id') id: string,
    @Body() dto: RecurrentAlertActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.recurrentAlertsService.justificar(
      +id,
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Get('alert-settings')
  getAlertSettings(@Req() req?: AuthRequest) {
    return this.attendancesService.getAlertSettings(
      institutionIdDeAlcance(req?.user, req),
    );
  }

  @Patch('alert-settings')
  @RequirePermiso('asistencia.editar')
  updateAlertSettings(@Body() dto: UpdateAlertSettingsDto, @Req() req: AuthRequest) {
    return this.attendancesService.updateAlertSettings(
      dto,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Get('alerts')
  findAlerts(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('mes') mes?: string,
    @Query('busqueda') busqueda?: string,
    @Query('soloCriticos') soloCriticos?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.findAlerts({
      nivel,
      grado,
      mes,
      busqueda,
      soloCriticos: soloCriticos === 'true',
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Post('alerts/notify')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  notifyApoderado(@Body() dto: NotifyApoderadoDto, @Req() req?: AuthRequest) {
    return this.attendancesService.notifyApoderado(dto, institutionIdDeAlcance(req?.user, req));
  }

  @Get('justifications/pending')
  findPending(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('mes') mes?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.attendancesService.findPending({ nivel, grado, mes, busqueda });
  }

  @Get('justifications')
  findJustifications(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('mes') mes?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.findJustifications({
      nivel,
      grado,
      mes,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Post('justifications')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  @UseInterceptors(FilesInterceptor('adjuntos', 5))
  createJustification(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateJustificationDto,
    @Req() req: AuthRequest,
  ) {
    return this.attendancesService.createJustification(dto, files ?? [], institutionIdDeAlcance(req.user, req));
  }

  @Delete('justifications/:id')
  removeJustification(@Param('id') id: string) {
    return this.attendancesService.removeJustification(+id);
  }

  @Post()
  @RequirePermiso('asistencia.registrar')
  create(@Body() createAttendanceDto: CreateAttendanceDto, @Req() req: AuthRequest) {
    return this.attendancesService.create(createAttendanceDto, institutionIdDeAlcance(req.user, req));
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('estado') estado?: string,
    @Query('mes') mes?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.attendancesService.findAll({
      studentId: studentId ? +studentId : undefined,
      estado,
      mes,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendancesService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermiso('asistencia.editar')
  update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendancesService.update(+id, updateAttendanceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendancesService.remove(+id);
  }
}
