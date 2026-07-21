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
import { SalonesService } from './salones.service';
import { CreateSalonDto, SyncSalonesDto, UpdateSalonDto } from './dto/salon.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';

@Controller('maestros/salones')
@UseGuards(JwtAuthGuard)
export class SalonesController {
  constructor(private readonly salonesService: SalonesService) {}

  @Get()
  @RequirePermiso('matricula.ver')
  @UseGuards(PermisoGuard)
  findAll(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('activo') activo?: string,
  ) {
    return this.salonesService.findAll({
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
    return this.salonesService.findVacancies({
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
      nivel,
      grado,
    });
  }

  @Post('sync')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  sync(@Body() dto: SyncSalonesDto) {
    return this.salonesService.syncFromInstitution(dto);
  }

  @Post()
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateSalonDto) {
    return this.salonesService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalonDto,
  ) {
    return this.salonesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.salonesService.remove(id);
  }
}
