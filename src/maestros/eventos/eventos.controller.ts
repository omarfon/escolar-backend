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
import { institutionIdDeAlcance } from '../../auth/siagie-access.util';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { CreateEventDto, UpdateEventDto } from '../../events/dto/event.dto';
import { EventosMaestrosService } from './eventos.service';
import { MaestrosAuthRequest } from '../common/maestros-tenant.util';

@Controller('maestros/eventos')
@UseGuards(JwtAuthGuard)
export class EventosMaestrosController {
  constructor(private readonly eventosService: EventosMaestrosService) {}

  @Get()
  @RequirePermiso('comunicados.ver', 'matricula.ver', 'horarios.ver')
  findAll(
    @Query('mes') mes?: string,
    @Query('tipo') tipo?: string,
    @Query('destinatarios') destinatarios?: string,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: Request & { user?: RequestUser },
  ) {
    return this.eventosService.findAll({
      mes,
      tipo,
      destinatarios,
      estado,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Post()
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateEventDto, @Req() req: Request & { user?: RequestUser }) {
    return this.eventosService.create(dto, req as MaestrosAuthRequest);
  }

  @Patch(':id')
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
    @Req() req: Request & { user?: RequestUser },
  ) {
    return this.eventosService.update(id, dto, req as MaestrosAuthRequest);
  }

  @Delete(':id')
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: RequestUser },
  ) {
    return this.eventosService.remove(id, req as MaestrosAuthRequest);
  }
}
