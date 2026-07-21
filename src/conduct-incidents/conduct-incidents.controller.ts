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
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('conduct-incidents')
@RequirePermiso('estudiantes.ver', 'evaluacion.ver')
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
    @Query('resumenPage') resumenPage?: string,
    @Query('resumenPageSize') resumenPageSize?: string,
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
      resumenPage ? +resumenPage : 1,
      resumenPageSize ? +resumenPageSize : 10,
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
