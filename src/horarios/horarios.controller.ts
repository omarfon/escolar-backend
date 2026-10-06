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
import { scopeFromCurriculaRequest } from '../curricula/curricula-scope.util';
import type { MaestrosAuthRequest } from '../maestros/common/maestros-tenant.util';
import { HorariosService } from './horarios.service';
import {
  CreateHorarioBlockDto,
  ResolveHorarioConflictsDto,
  UpdateHorarioBlockDto,
} from './dto/horario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('horarios')
@UseGuards(JwtAuthGuard)
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  @Get('context')
  @RequirePermiso('horarios.ver', 'docentes.horario', 'docentes.ver')
  @UseGuards(PermisoGuard)
  getContext(
    @Req() req: Request,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const anio = anioEscolar ? +anioEscolar : new Date().getFullYear();
    return this.horariosService.getContext(anio, scopeFromCurriculaRequest(req));
  }

  @Get('conflicts')
  @RequirePermiso('horarios.ver', 'docentes.horario', 'docentes.ver')
  @UseGuards(PermisoGuard)
  getConflicts(
    @Req() req: Request,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const anio = anioEscolar ? +anioEscolar : new Date().getFullYear();
    return this.horariosService.getConflicts(
      anio,
      scopeFromCurriculaRequest(req),
    );
  }

  @Post('blocks')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  createBlock(
    @Req() req: Request,
    @Body() dto: CreateHorarioBlockDto,
  ) {
    return this.horariosService.createBlock(dto, req as MaestrosAuthRequest);
  }

  @Patch('blocks/:id')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  updateBlock(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioBlockDto,
  ) {
    return this.horariosService.updateBlock(id, dto, req as MaestrosAuthRequest);
  }

  @Delete('blocks/:id')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  deleteBlock(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.horariosService.deleteBlock(id, req as MaestrosAuthRequest);
  }

  @Post('conflicts/resolve')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  resolveConflicts(@Body() dto: ResolveHorarioConflictsDto) {
    return this.horariosService.resolveConflicts(dto);
  }

  @Post('seed')
  @RequirePermiso('horarios.crear')
  @UseGuards(PermisoGuard)
  seedDemo(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('force') force?: string,
  ) {
    const anio = anioEscolar ? +anioEscolar : new Date().getFullYear();
    return this.horariosService.seedDemoHorarios(anio, force === 'true');
  }
}
