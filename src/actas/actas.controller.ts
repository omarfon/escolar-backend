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
import { ActasService } from './actas.service';
import { ApproveActaDto, GenerateActaDto } from './dto/acta.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('actas')
@RequirePermiso('evaluacion.ver')
export class ActasController {
  constructor(private readonly actasService: ActasService) {}

  @Get()
  findAll(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('bimestre') bimestre?: string,
    @Query('estado') estado?: string,
  ) {
    return this.actasService.findAll({
      nivel,
      grado,
      seccion,
      bimestre: bimestre ? +bimestre : undefined,
      estado,
    });
  }

  @Get('bimestres')
  getBimestres() {
    return this.actasService.getBimestresDisponibles();
  }

  @Post('generate')
  @RequirePermiso('evaluacion.aprobar', 'evaluacion.registrar')
  generate(@Body() dto: GenerateActaDto) {
    return this.actasService.generate(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actasService.findOne(+id);
  }

  @Patch(':id/approve')
  @RequirePermiso('evaluacion.aprobar')
  approve(@Param('id') id: string, @Body() dto: ApproveActaDto) {
    return this.actasService.approve(+id, dto);
  }

  @Patch(':id/close')
  @RequirePermiso('evaluacion.aprobar')
  close(@Param('id') id: string) {
    return this.actasService.close(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actasService.remove(+id);
  }
}
