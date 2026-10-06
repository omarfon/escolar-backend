import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import {
  PERMISO_CALENDARIZACION_GESTIONAR,
  PERMISO_CALENDARIZACION_VER,
} from '../anios-escolares/anio-escolar.constants';
import {
  CreateMaestroPeriodoAcademicoDto,
  DividirPeriodosAnioEscolarDto,
  UpdateMaestroPeriodoAcademicoDto,
} from './dto/maestro-periodo-academico.dto';
import {
  PeriodoAcademicoActorContext,
  PeriodosAcademicosMaestrosService,
} from './periodos-academicos.service';

type AuthRequest = Request;

const PERMISO_LECTURA = [
  PERMISO_CALENDARIZACION_VER,
  PERMISO_CALENDARIZACION_GESTIONAR,
  'admin.institucional',
  'horarios.ver',
  'evaluacion.ver',
  'matricula.ver',
] as const;

@Controller('maestros/periodos-academicos')
@UseGuards(JwtAuthGuard)
export class PeriodosAcademicosMaestrosController {
  constructor(
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  @Get('actual')
  @RequirePermiso(...PERMISO_LECTURA)
  findActual() {
    return this.periodosService.findPeriodoActual();
  }

  @Get('catalogo-anios')
  @RequirePermiso(...PERMISO_LECTURA)
  catalogoAnios(@Req() req: AuthRequest) {
    return this.periodosService.listCatalogoAniosEscolares(this.actor(req));
  }

  @Get()
  @RequirePermiso(...PERMISO_LECTURA)
  findAll(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('tipo') tipo?: string,
    @Query('activo') activo?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.periodosService.findAll(
      {
        anioEscolar: anioEscolar ? +anioEscolar : undefined,
        tipo: tipo || undefined,
        activo: activo === undefined ? undefined : activo === 'true',
      },
      req ? this.actor(req) : undefined,
    );
  }

  @Post('dividir')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  dividir(@Body() dto: DividirPeriodosAnioEscolarDto, @Req() req: AuthRequest) {
    return this.periodosService.dividirPeriodos(dto, this.actor(req));
  }

  @Get(':id')
  @RequirePermiso(...PERMISO_LECTURA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.findOne(id);
  }

  @Post()
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroPeriodoAcademicoDto, @Req() req: AuthRequest) {
    return this.periodosService.create(dto, this.actor(req));
  }

  @Patch(':id')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroPeriodoAcademicoDto,
    @Req() req: AuthRequest,
  ) {
    return this.periodosService.update(id, dto, this.actor(req));
  }

  @Patch(':id/actual')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  marcarActual(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.periodosService.marcarActual(id, this.actor(req));
  }

  @Delete(':id')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.periodosService.remove(id, this.actor(req));
  }

  private actor(req: AuthRequest): PeriodoAcademicoActorContext {
    return { req };
  }
}
