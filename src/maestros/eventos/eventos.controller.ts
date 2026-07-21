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
import { CreateEventDto, UpdateEventDto } from '../../events/dto/event.dto';
import { EventosMaestrosService } from './eventos.service';

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
  ) {
    return this.eventosService.findAll({
      mes,
      tipo,
      destinatarios,
      estado,
      busqueda,
    });
  }

  @Post()
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateEventDto) {
    return this.eventosService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventosService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('comunicados.ver', 'matricula.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.eventosService.remove(id);
  }
}
