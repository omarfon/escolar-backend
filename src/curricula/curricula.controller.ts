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
} from '@nestjs/common';
import { CurriculaService } from './curricula.service';
import {
  CreateCurriculumAreaDto,
  CreateCurriculumDto,
  CreateCurriculumSubjectDto,
  CreateTeacherAssignmentDto,
  UpdateCurriculumAreaDto,
  UpdateCurriculumDto,
  UpdateCurriculumSubjectDto,
  UpdateTeacherAssignmentDto,
} from './dto/curricula.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('curricula')
@RequirePermiso(
  'evaluacion.ver',
  'matricula.ver',
  'admin.institucional',
  'estudiantes.ver',
  'horarios.ver',
  'docentes.ver',
)
export class CurriculaController {
  constructor(private readonly curriculaService: CurriculaService) {}

  @Get('catalog')
  getCatalog(
    @Query('curriculumId') curriculumId?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.curriculaService.getCatalog(
      curriculumId ? Number(curriculumId) : undefined,
      nivel,
    );
  }

  @Get()
  findCurriculas(
    @Query('anio') anio?: string,
    @Query('nivel') nivel?: string,
    @Query('estado') estado?: string,
  ) {
    return this.curriculaService.findCurriculas({
      anio: anio ? Number(anio) : undefined,
      nivel,
      estado,
    });
  }

  @Post()
  createCurriculum(@Body() dto: CreateCurriculumDto) {
    return this.curriculaService.createCurriculum(dto);
  }

  @Patch(':id')
  updateCurriculum(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumDto,
  ) {
    return this.curriculaService.updateCurriculum(id, dto);
  }

  @Get(':id/summary')
  getSummary(@Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.getCurriculumSummary(id);
  }

  @Get(':id/malla')
  getMalla(@Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.getMalla(id);
  }

  @Post(':id/copy')
  copyCurriculum(@Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.copyCurriculum(id);
  }

  @Get('areas/list')
  findAreas(@Query('curriculumId') curriculumId?: string) {
    return this.curriculaService.findAreas(
      curriculumId ? Number(curriculumId) : undefined,
    );
  }

  @Post('areas')
  createArea(@Body() dto: CreateCurriculumAreaDto) {
    return this.curriculaService.createArea(dto);
  }

  @Patch('areas/:id')
  updateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumAreaDto,
  ) {
    return this.curriculaService.updateArea(id, dto);
  }

  @Get('subjects/list')
  findSubjects(@Query('curriculumId') curriculumId?: string) {
    return this.curriculaService.findSubjects(
      curriculumId ? Number(curriculumId) : undefined,
    );
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateCurriculumSubjectDto) {
    return this.curriculaService.createSubject(dto);
  }

  @Patch('subjects/:id')
  updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumSubjectDto,
  ) {
    return this.curriculaService.updateSubject(id, dto);
  }

  @Get('asignacion/context')
  getAsignacionContext(
    @Query('anio') anio?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.curriculaService.getAsignacionContext(
      anio ? Number(anio) : new Date().getFullYear(),
      nivel,
    );
  }

  @Get('assignments/list')
  findAssignments(@Query('curriculumId') curriculumId?: string) {
    return this.curriculaService.findAssignments(
      curriculumId ? Number(curriculumId) : undefined,
    );
  }

  @Post('assignments')
  createAssignment(@Body() dto: CreateTeacherAssignmentDto) {
    return this.curriculaService.createAssignment(dto);
  }

  @Patch('assignments/:id')
  updateAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherAssignmentDto,
  ) {
    return this.curriculaService.updateAssignment(id, dto);
  }

  @Delete('assignments/:id')
  deleteAssignment(@Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.deleteAssignment(id);
  }
}
