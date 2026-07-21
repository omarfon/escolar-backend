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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import {
  CreateMaestroPeriodoAcademicoDto,
  UpdateMaestroPeriodoAcademicoDto,
} from './dto/maestro-periodo-academico.dto';
import { PeriodosAcademicosMaestrosService } from './periodos-academicos.service';

@Controller('maestros/periodos-academicos')
@UseGuards(JwtAuthGuard)
export class PeriodosAcademicosMaestrosController {
  constructor(
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  @Get()
  findAll(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('tipo') tipo?: string,
    @Query('activo') activo?: string,
  ) {
    return this.periodosService.findAll({
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      tipo: tipo || undefined,
      activo: activo === undefined ? undefined : activo === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.findOne(id);
  }

  @Post()
  @RequirePermiso('horarios.ver', 'evaluacion.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroPeriodoAcademicoDto) {
    return this.periodosService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('horarios.ver', 'evaluacion.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroPeriodoAcademicoDto,
  ) {
    return this.periodosService.update(id, dto);
  }

  @Patch(':id/actual')
  @RequirePermiso('horarios.ver', 'evaluacion.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  marcarActual(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.marcarActual(id);
  }

  @Delete(':id')
  @RequirePermiso('horarios.ver', 'evaluacion.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.remove(id);
  }
}
