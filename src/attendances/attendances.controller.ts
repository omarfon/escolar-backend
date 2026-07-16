import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateJustificationDto } from './dto/justification.dto';
import { UpdateAlertSettingsDto } from './dto/alert-settings.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get('alert-settings')
  getAlertSettings() {
    return this.attendancesService.getAlertSettings();
  }

  @Patch('alert-settings')
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
  createJustification(@Body() dto: CreateJustificationDto) {
    return this.attendancesService.createJustification(dto);
  }

  @Delete('justifications/:id')
  removeJustification(@Param('id') id: string) {
    return this.attendancesService.removeJustification(+id);
  }

  @Post()
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendancesService.create(createAttendanceDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('estado') estado?: string,
    @Query('mes') mes?: string,
  ) {
    return this.attendancesService.findAll({
      studentId: studentId ? +studentId : undefined,
      estado,
      mes,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendancesService.findOne(+id);
  }

  @Patch(':id')
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
