import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import {
  PERMISO_CALENDARIZACION_GESTIONAR,
  PERMISO_CALENDARIZACION_VER,
} from '../anios-escolares/anio-escolar.constants';
import { CalendarioEscolarService } from './calendario.service';
import { CalendarioQueryDto } from './dto/calendario.dto';

type AuthRequest = Request & { user?: RequestUser };

const PERMISO_LECTURA_CALENDARIO = [
  PERMISO_CALENDARIZACION_VER,
  PERMISO_CALENDARIZACION_GESTIONAR,
  'admin.institucional',
  'horarios.ver',
  'evaluacion.ver',
  'matricula.ver',
  'comunicados.ver',
  'asistencia.ver',
] as const;

@Controller('maestros/calendario')
@UseGuards(JwtAuthGuard)
export class CalendarioEscolarController {
  constructor(private readonly service: CalendarioEscolarService) {}

  @Get('context')
  @RequirePermiso(...PERMISO_LECTURA_CALENDARIO)
  getContext(@Req() req: AuthRequest) {
    return this.service.getContext(req);
  }

  @Get()
  @RequirePermiso(...PERMISO_LECTURA_CALENDARIO)
  getVisualizacion(@Req() req: AuthRequest, @Query() query: CalendarioQueryDto) {
    return this.service.getVisualizacion(req, query);
  }
}
