import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import {
  PERMISO_CALENDARIZACION_GESTIONAR,
  PERMISO_CALENDARIZACION_VER,
} from './anio-escolar.constants';
import {
  ActivarAnioEscolarDto,
  CerrarAnioEscolarDto,
  CopiarCalendarioAnioEscolarDto,
  CreateAnioEscolarDto,
  DividirPeriodosPorAnioIdDto,
  ListAniosEscolaresQueryDto,
  PublicarComunicadoCalendarioDto,
} from './dto/anio-escolar.dto';
import { resolveTenantScopeFromRequest } from '../../auth/tenant-scope.util';
import { AnioEscolarActorContext, AniosEscolaresService } from './anios-escolares.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('maestros/anios-escolares')
@UseGuards(JwtAuthGuard)
export class AniosEscolaresController {
  constructor(private readonly service: AniosEscolaresService) {}

  @Get('context')
  @RequirePermiso(
    PERMISO_CALENDARIZACION_VER,
    PERMISO_CALENDARIZACION_GESTIONAR,
    'admin.institucional',
    'horarios.ver',
    'evaluacion.ver',
    'matricula.ver',
  )
  getContext(@Req() req: AuthRequest) {
    return this.service.getContext(this.actor(req));
  }

  @Get()
  @RequirePermiso(
    PERMISO_CALENDARIZACION_VER,
    PERMISO_CALENDARIZACION_GESTIONAR,
    'admin.institucional',
    'horarios.ver',
    'evaluacion.ver',
    'matricula.ver',
  )
  findAll(@Query() query: ListAniosEscolaresQueryDto, @Req() req: AuthRequest) {
    return this.service.findAll(query, this.actor(req));
  }

  @Get(':id')
  @RequirePermiso(
    PERMISO_CALENDARIZACION_VER,
    PERMISO_CALENDARIZACION_GESTIONAR,
    'admin.institucional',
    'horarios.ver',
    'evaluacion.ver',
    'matricula.ver',
  )
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.service.findOne(id, this.actor(req));
  }

  @Post()
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateAnioEscolarDto, @Req() req: AuthRequest) {
    return this.service.create(dto, this.actor(req));
  }

  @Post(':id/activar')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActivarAnioEscolarDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.activate(id, dto, this.actor(req));
  }

  @Post(':id/cerrar')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CerrarAnioEscolarDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.close(id, dto, this.actor(req));
  }

  @Post(':id/dividir-periodos')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  dividirPeriodos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DividirPeriodosPorAnioIdDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.dividirPeriodos(id, dto, this.actor(req));
  }

  @Post(':id/copiar-calendario')
  @RequirePermiso(PERMISO_CALENDARIZACION_GESTIONAR, 'admin.institucional')
  @UseGuards(PermisoGuard)
  copyCalendario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CopiarCalendarioAnioEscolarDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.copyCalendario(id, dto, this.actor(req));
  }

  @Post(':id/publicar-comunicado')
  @HttpCode(201)
  @RequirePermiso(
    PERMISO_CALENDARIZACION_GESTIONAR,
    'comunicados.enviar',
    'admin.institucional',
  )
  @UseGuards(PermisoGuard)
  publicarComunicado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublicarComunicadoCalendarioDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.publicarComunicado(id, dto, this.actor(req));
  }

  private actor(req: AuthRequest): AnioEscolarActorContext {
    const scope = resolveTenantScopeFromRequest(req, { mode: 'optional' });
    return {
      req,
      permisos: req.user?.permisos ?? [],
      ambitos: req.user?.ambitos ?? [],
      esAdmin: req.user?.esAdmin ?? false,
      institutionId: scope.institutionId ?? req.user?.institutionId ?? null,
    };
  }
}
