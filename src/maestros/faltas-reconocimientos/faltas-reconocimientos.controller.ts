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
  CreateMaestroConductaDescripcionDto,
  CreateMaestroConductaTipoDto,
  UpdateMaestroConductaDescripcionDto,
  UpdateMaestroConductaTipoDto,
} from './dto/faltas-reconocimientos.dto';
import { FaltasReconocimientosService } from './faltas-reconocimientos.service';

@Controller('maestros/faltas-reconocimientos')
@UseGuards(JwtAuthGuard)
export class FaltasReconocimientosController {
  constructor(
    private readonly faltasService: FaltasReconocimientosService,
  ) {}

  @Get()
  findAll(@Query('activo') activo?: string) {
    return this.faltasService.findAll(
      activo === undefined ? undefined : activo === 'true',
    );
  }

  @Post('tipos')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  createTipo(@Body() dto: CreateMaestroConductaTipoDto) {
    return this.faltasService.createTipo(dto);
  }

  @Patch('tipos/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  updateTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroConductaTipoDto,
  ) {
    return this.faltasService.updateTipo(id, dto);
  }

  @Delete('tipos/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  removeTipo(@Param('id', ParseIntPipe) id: number) {
    return this.faltasService.removeTipo(id);
  }

  @Post('tipos/:tipoId/descripciones')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  createDescripcion(
    @Param('tipoId', ParseIntPipe) tipoId: number,
    @Body() dto: CreateMaestroConductaDescripcionDto,
  ) {
    return this.faltasService.createDescripcion(tipoId, dto);
  }

  @Patch('descripciones/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  updateDescripcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroConductaDescripcionDto,
  ) {
    return this.faltasService.updateDescripcion(id, dto);
  }

  @Delete('descripciones/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  removeDescripcion(@Param('id', ParseIntPipe) id: number) {
    return this.faltasService.removeDescripcion(id);
  }
}
