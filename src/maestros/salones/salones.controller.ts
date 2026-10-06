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
import { SalonesService } from './salones.service';
import { CreateSalonDto, SyncSalonesDto, UpdateSalonDto } from './dto/salon.dto';
import { MaestrosAuthRequest } from '../common/maestros-tenant.util';
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
    @Req() req?: Request,
  ) {
    return this.salonesService.findAll(
      {
        anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
        nivel,
        grado,
        activo: activo === undefined ? undefined : activo === 'true',
      },
      req,
    );
  }

  @Get('vacancies')
  @RequirePermiso('matricula.ver')
  @UseGuards(PermisoGuard)
  findVacancies(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Req() req?: Request,
  ) {
    return this.salonesService.findVacancies(
      {
        anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
        nivel,
        grado,
      },
      req,
    );
  }

  @Post('sync')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  sync(@Body() dto: SyncSalonesDto, @Req() req: Request) {
    return this.salonesService.syncFromInstitution(dto, req as MaestrosAuthRequest);
  }

  @Post()
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateSalonDto, @Req() req: Request) {
    return this.salonesService.create(dto, req as MaestrosAuthRequest);
  }

  @Patch(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalonDto,
    @Req() req: Request,
  ) {
    return this.salonesService.update(id, dto, req as MaestrosAuthRequest);
  }

  @Delete(':id')
  @RequirePermiso('matricula.vacantes')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.salonesService.remove(id, req as MaestrosAuthRequest);
  }
}
