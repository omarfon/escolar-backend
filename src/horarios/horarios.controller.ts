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
  UseGuards,
} from '@nestjs/common';
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
  getContext(@Query('anioEscolar') anioEscolar?: string) {
    const anio = anioEscolar ? +anioEscolar : new Date().getFullYear();
    return this.horariosService.getContext(anio);
  }

  @Get('conflicts')
  @RequirePermiso('horarios.ver', 'docentes.horario', 'docentes.ver')
  @UseGuards(PermisoGuard)
  getConflicts(@Query('anioEscolar') anioEscolar?: string) {
    const anio = anioEscolar ? +anioEscolar : new Date().getFullYear();
    return this.horariosService.getConflicts(anio);
  }

  @Post('blocks')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  createBlock(@Body() dto: CreateHorarioBlockDto) {
    return this.horariosService.createBlock(dto);
  }

  @Patch('blocks/:id')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  updateBlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioBlockDto,
  ) {
    return this.horariosService.updateBlock(id, dto);
  }

  @Delete('blocks/:id')
  @RequirePermiso('horarios.crear', 'docentes.horario')
  @UseGuards(PermisoGuard)
  deleteBlock(@Param('id', ParseIntPipe) id: number) {
    return this.horariosService.deleteBlock(id);
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
