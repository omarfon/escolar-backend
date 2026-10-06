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
import { CursosMaestrosService } from './cursos.service';
import {
  CreateMaestroCursoDto,
  UpdateMaestroCursoDto,
} from './dto/maestro-curso.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { MaestrosAuthRequest } from '../common/maestros-tenant.util';

@Controller('maestros/cursos')
@UseGuards(JwtAuthGuard)
export class CursosMaestrosController {
  constructor(private readonly cursosService: CursosMaestrosService) {}

  @Get()
  findAll(
    @Query('nivel') nivel?: string,
    @Query('area') area?: string,
    @Query('activo') activo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: Request,
  ) {
    const query = {
      nivel,
      area,
      activo: activo === undefined ? undefined : activo === 'true',
    };
    return this.cursosService.findPaginated(
      query,
      page ? Math.max(1, Number(page)) : 1,
      pageSize ? Math.max(1, Number(pageSize)) : 10,
      req as MaestrosAuthRequest,
    );
  }

  @Post()
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroCursoDto, @Req() req: Request) {
    return this.cursosService.create(dto, req as MaestrosAuthRequest);
  }

  @Patch(':id')
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroCursoDto,
    @Req() req: Request,
  ) {
    return this.cursosService.update(id, dto, req as MaestrosAuthRequest);
  }

  @Delete(':id')
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.cursosService.remove(id, req as MaestrosAuthRequest);
  }
}
