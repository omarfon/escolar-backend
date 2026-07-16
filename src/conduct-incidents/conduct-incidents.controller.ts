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
import {
  CreateConductIncidentDto,
  UpdateConductIncidentDto,
} from './dto/conduct-incident.dto';
import { ConductIncidentsService } from './conduct-incidents.service';

@Controller('conduct-incidents')
export class ConductIncidentsController {
  constructor(private readonly conductService: ConductIncidentsService) {}

  @Post()
  create(@Body() dto: CreateConductIncidentDto) {
    return this.conductService.create(dto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
    @Query('nivel') nivel?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.conductService.findAllPaginated(
      {
        studentId: studentId ? +studentId : undefined,
        grado,
        seccion,
        tipo,
        estado,
        busqueda,
        nivel,
      },
      page ? +page : 1,
      pageSize ? +pageSize : 10,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conductService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConductIncidentDto) {
    return this.conductService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.conductService.remove(+id);
  }
}
