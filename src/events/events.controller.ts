import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventsService } from './events.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';

type AuthRequest = { user?: RequestUser };

@Controller('events')
@RequirePermiso('comunicados.ver', 'matricula.ver', 'horarios.ver')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto, @Req() req: AuthRequest) {
    return this.eventsService.create(dto, institutionIdDeAlcance(req.user, req));
  }

  @Get()
  findAll(
    @Query('mes') mes?: string,
    @Query('tipo') tipo?: string,
    @Query('destinatarios') destinatarios?: string,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.eventsService.findAll({
      mes,
      tipo,
      destinatarios,
      estado,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.eventsService.findOne(+id, institutionIdDeAlcance(req.user, req));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @Req() req: AuthRequest) {
    return this.eventsService.update(+id, dto, institutionIdDeAlcance(req.user, req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.eventsService.remove(+id, institutionIdDeAlcance(req.user, req));
  }
}
