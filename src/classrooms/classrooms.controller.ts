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
import { ClassroomsService } from './classrooms.service';
import {
  CreateClassroomDto,
  SyncClassroomsDto,
  UpdateClassroomDto,
} from './dto/classroom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('classrooms')
@UseGuards(JwtAuthGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @RequirePermiso('matricula.ver')
  @UseGuards(PermisoGuard)
  findAll(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('activo') activo?: string,
  ) {
    return this.classroomsService.findAll({
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
      nivel,
      grado,
      activo: activo === undefined ? undefined : activo === 'true',
    });
  }

  @Get('vacancies')
  @RequirePermiso('matricula.ver')
  @UseGuards(PermisoGuard)
  findVacancies(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
  ) {
    return this.classroomsService.findVacancies({
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
      nivel,
      grado,
    });
  }

  @Post('sync')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  sync(@Body() dto: SyncClassroomsDto) {
    return this.classroomsService.syncFromInstitution(dto);
  }

  @Post()
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateClassroomDto) {
    return this.classroomsService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.classroomsService.remove(id);
  }
}
