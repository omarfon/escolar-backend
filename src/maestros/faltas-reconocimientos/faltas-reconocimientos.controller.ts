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
  CreateMaestroConductaDescripcionDto,
  CreateMaestroConductaTipoDto,
  UpdateMaestroConductaDescripcionDto,
  UpdateMaestroConductaTipoDto,
} from './dto/faltas-reconocimientos.dto';
import { FaltasReconocimientosService } from './faltas-reconocimientos.service';
import { MaestrosAuthRequest } from '../common/maestros-tenant.util';

@Controller('maestros/faltas-reconocimientos')
@UseGuards(JwtAuthGuard)
export class FaltasReconocimientosController {
  constructor(
    private readonly faltasService: FaltasReconocimientosService,
  ) {}

  @Get()
  findAll(@Query('activo') activo?: string, @Req() req?: Request) {
    return this.faltasService.findAll(
      activo === undefined ? undefined : activo === 'true',
      req as MaestrosAuthRequest,
    );
  }

  @Post('tipos')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  createTipo(@Body() dto: CreateMaestroConductaTipoDto, @Req() req: Request) {
    return this.faltasService.createTipo(dto, req as MaestrosAuthRequest);
  }

  @Patch('tipos/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  updateTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroConductaTipoDto,
    @Req() req: Request,
  ) {
    return this.faltasService.updateTipo(id, dto, req as MaestrosAuthRequest);
  }

  @Delete('tipos/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  removeTipo(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.faltasService.removeTipo(id, req as MaestrosAuthRequest);
  }

  @Post('tipos/:tipoId/descripciones')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  createDescripcion(
    @Param('tipoId', ParseIntPipe) tipoId: number,
    @Body() dto: CreateMaestroConductaDescripcionDto,
    @Req() req: Request,
  ) {
    return this.faltasService.createDescripcion(
      tipoId,
      dto,
      req as MaestrosAuthRequest,
    );
  }

  @Patch('descripciones/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  updateDescripcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroConductaDescripcionDto,
    @Req() req: Request,
  ) {
    return this.faltasService.updateDescripcion(id, dto, req as MaestrosAuthRequest);
  }

  @Delete('descripciones/:id')
  @RequirePermiso('estudiantes.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  removeDescripcion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.faltasService.removeDescripcion(id, req as MaestrosAuthRequest);
  }
}
