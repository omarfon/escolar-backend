import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get()
  findAll(
    @Query('mes') mes?: string,
    @Query('tipo') tipo?: string,
    @Query('destinatarios') destinatarios?: string,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.eventsService.findAll({
      mes,
      tipo,
      destinatarios,
      estado,
      busqueda,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(+id);
  }
}
