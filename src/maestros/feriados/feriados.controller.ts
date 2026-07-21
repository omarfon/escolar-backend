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
import { FeriadosMaestrosService } from './feriados.service';
import {
  CreateMaestroFeriadoDto,
  UpdateMaestroFeriadoDto,
} from './dto/maestro-feriado.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';

@Controller('maestros/feriados')
@UseGuards(JwtAuthGuard)
export class FeriadosMaestrosController {
  constructor(private readonly feriadosService: FeriadosMaestrosService) {}

  @Get()
  findAll(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('activo') activo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.feriadosService.findAll({
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      activo: activo === undefined ? undefined : activo === 'true',
      desde,
      hasta,
    });
  }

  @Get('dias-clase')
  calcularDiasClase(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.feriadosService.calcularDiasClase(
      desde,
      hasta,
      anioEscolar ? +anioEscolar : undefined,
    );
  }

  @Get('verificar')
  verificarFecha(
    @Query('fecha') fecha: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.feriadosService.getFeriadoEnFecha(
      fecha,
      anioEscolar ? +anioEscolar : undefined,
    );
  }

  @Post()
  @RequirePermiso('asistencia.ver', 'matricula.ver', 'horarios.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroFeriadoDto) {
    return this.feriadosService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('asistencia.ver', 'matricula.ver', 'horarios.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroFeriadoDto,
  ) {
    return this.feriadosService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('asistencia.ver', 'matricula.ver', 'horarios.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.feriadosService.remove(id);
  }
}
