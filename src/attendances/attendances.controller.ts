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
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateJustificationDto } from './dto/justification.dto';
import { UpdateAlertSettingsDto } from './dto/alert-settings.dto';
import { NotifyApoderadoDto } from './dto/notify-apoderado.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { SaveDailyRegisterDto } from './dto/daily-register.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('attendances')
@RequirePermiso('asistencia.ver')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get('control-report/export')
  @RequirePermiso('asistencia.exportar', 'asistencia.reportes')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportControlReport(
    @Query('mes') mes?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('busqueda') busqueda?: string,
    @Res() res?: Response,
  ) {
    const report = await this.attendancesService.getControlReport({
      mes,
      nivel,
      grado,
      seccion,
      busqueda,
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
  ) {
    return this.attendancesService.getControlReport({
      mes,
      nivel,
      grado,
      seccion,
      busqueda,
    });
  }

  @Get('daily-register/calendar')
  getDailyRegisterCalendar(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('mes') mes: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.attendancesService.getDailyRegisterCalendar({
      nivel,
      grado,
      seccion,
      mes,
      fecha,
    });
  }

  @Get('daily-register')
  getDailyRegister(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('fecha') fecha: string,
  ) {
    return this.attendancesService.getDailyRegister({
      nivel,
      grado,
      seccion,
      fecha,
    });
  }

  @Post('daily-register')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  saveDailyRegister(@Body() dto: SaveDailyRegisterDto) {
    return this.attendancesService.saveDailyRegister(dto);
  }

  @Get('alert-settings')
  getAlertSettings() {
    return this.attendancesService.getAlertSettings();
  }

  @Patch('alert-settings')
  @RequirePermiso('asistencia.editar')
  updateAlertSettings(@Body() dto: UpdateAlertSettingsDto) {
    return this.attendancesService.updateAlertSettings(dto);
  }

  @Get('alerts')
  findAlerts(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('mes') mes?: string,
    @Query('busqueda') busqueda?: string,
    @Query('soloCriticos') soloCriticos?: string,
  ) {
    return this.attendancesService.findAlerts({
      nivel,
      grado,
      mes,
      busqueda,
      soloCriticos: soloCriticos === 'true',
    });
  }

  @Post('alerts/notify')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  notifyApoderado(@Body() dto: NotifyApoderadoDto) {
    return this.attendancesService.notifyApoderado(dto);
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
  ) {
    return this.attendancesService.findJustifications({
      nivel,
      grado,
      mes,
      busqueda,
    });
  }

  @Post('justifications')
  @RequirePermiso('asistencia.registrar', 'asistencia.editar')
  @UseInterceptors(FilesInterceptor('adjuntos', 5))
  createJustification(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateJustificationDto,
  ) {
    return this.attendancesService.createJustification(dto, files ?? []);
  }

  @Delete('justifications/:id')
  removeJustification(@Param('id') id: string) {
    return this.attendancesService.removeJustification(+id);
  }

  @Post()
  @RequirePermiso('asistencia.registrar')
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendancesService.create(createAttendanceDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('estado') estado?: string,
    @Query('mes') mes?: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.attendancesService.findAll({
      studentId: studentId ? +studentId : undefined,
      estado,
      mes,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
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
