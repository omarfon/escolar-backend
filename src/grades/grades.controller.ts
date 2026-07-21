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
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { SaveGradeRegistryDto } from './dto/grade-registry.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('grades')
@RequirePermiso('evaluacion.ver')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('registry/contexts')
  listRegistryContexts(@Query('bimestre') bimestre?: string) {
    return this.gradesService.listRegistryContexts(
      bimestre ? +bimestre : 2,
    );
  }

  @Get('registry')
  getRegistry(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('curso') curso: string,
    @Query('bimestre') bimestre: string,
  ) {
    return this.gradesService.getRegistry({
      nivel,
      grado,
      seccion,
      curso,
      bimestre: +bimestre,
    });
  }

  @Post('registry/bulk')
  @RequirePermiso('evaluacion.registrar', 'evaluacion.editar')
  saveRegistryBulk(@Body() dto: SaveGradeRegistryDto) {
    return this.gradesService.saveRegistryBulk(dto);
  }

  @Get('averages')
  @RequirePermiso('evaluacion.reportes', 'evaluacion.ver')
  computeAverages(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('curso') curso?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.gradesService.computeAverages({
      nivel,
      grado,
      seccion,
      curso,
      busqueda,
    });
  }

  @Post()
  @RequirePermiso('evaluacion.registrar')
  create(@Body() createGradeDto: CreateGradeDto) {
    return this.gradesService.create(createGradeDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
  ) {
    return this.gradesService.findAll({
      studentId: studentId ? +studentId : undefined,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gradesService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermiso('evaluacion.editar')
  update(@Param('id') id: string, @Body() updateGradeDto: UpdateGradeDto) {
    return this.gradesService.update(+id, updateGradeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gradesService.remove(+id);
  }
}
