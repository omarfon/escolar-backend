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
import { CursosMaestrosService } from './cursos.service';
import {
  CreateMaestroCursoDto,
  UpdateMaestroCursoDto,
} from './dto/maestro-curso.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';

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
  ) {
    return this.cursosService.findPaginated(
      {
        nivel,
        area,
        activo: activo === undefined ? undefined : activo === 'true',
      },
      page ? Math.max(1, Number(page)) : 1,
      pageSize ? Math.max(1, Number(pageSize)) : 10,
    );
  }

  @Post()
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroCursoDto) {
    return this.cursosService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroCursoDto,
  ) {
    return this.cursosService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('horarios.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cursosService.remove(id);
  }
}
