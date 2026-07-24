import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import {
  CreateEducationLevelDto,
  UpdateEducationLevelDto,
} from './dto/education-level.dto';
import {
  CreateGradeLevelDto,
  UpdateGradeLevelDto,
} from './dto/grade-level.dto';
import {
  CreateGradeSectionDto,
  UpdateGradeSectionDto,
} from './dto/grade-section.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('institution')
@RequirePermiso('admin.institucional')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get()
  getConfig() {
    return this.institutionService.getConfig();
  }

  @Patch()
  updateInstitution(@Body() dto: UpdateInstitutionDto) {
    return this.institutionService.updateInstitution(dto);
  }

  @Get('education-levels')
  @RequirePermiso(
    'admin.institucional',
    'evaluacion.ver',
    'asistencia.ver',
    'horarios.ver',
    'matricula.ver',
    'estudiantes.ver',
    'comunicados.ver',
  )
  findAllEducationLevels() {
    return this.institutionService.findAllEducationLevels();
  }

  @Post('education-levels')
  createEducationLevel(@Body() dto: CreateEducationLevelDto) {
    return this.institutionService.createEducationLevel(dto);
  }

  @Patch('education-levels/:id')
  updateEducationLevel(@Param('id') id: string, @Body() dto: UpdateEducationLevelDto) {
    return this.institutionService.updateEducationLevel(+id, dto);
  }

  @Delete('education-levels/:id')
  removeEducationLevel(@Param('id') id: string) {
    return this.institutionService.removeEducationLevel(+id);
  }

  @Post('education-levels/:id/grades')
  createGradeLevel(@Param('id') id: string, @Body() dto: CreateGradeLevelDto) {
    return this.institutionService.createGradeLevel(+id, dto);
  }

  @Patch('grade-levels/:id')
  updateGradeLevel(@Param('id') id: string, @Body() dto: UpdateGradeLevelDto) {
    return this.institutionService.updateGradeLevel(+id, dto);
  }

  @Delete('grade-levels/:id')
  removeGradeLevel(@Param('id') id: string) {
    return this.institutionService.removeGradeLevel(+id);
  }

  @Post('grade-levels/:id/sections')
  createGradeSection(@Param('id') id: string, @Body() dto: CreateGradeSectionDto) {
    return this.institutionService.createGradeSection(+id, dto);
  }

  @Patch('grade-sections/:id')
  updateGradeSection(@Param('id') id: string, @Body() dto: UpdateGradeSectionDto) {
    return this.institutionService.updateGradeSection(+id, dto);
  }

  @Delete('grade-sections/:id')
  removeGradeSection(@Param('id') id: string) {
    return this.institutionService.removeGradeSection(+id);
  }

  @Get('campuses')
  findAllCampuses() {
    return this.institutionService.findAllCampuses();
  }

  @Get('campuses/:id')
  findCampus(@Param('id') id: string) {
    return this.institutionService.findCampus(+id);
  }

  @Post('campuses')
  createCampus(@Body() dto: CreateCampusDto) {
    return this.institutionService.createCampus(dto);
  }

  @Patch('campuses/:id')
  updateCampus(@Param('id') id: string, @Body() dto: UpdateCampusDto) {
    return this.institutionService.updateCampus(+id, dto);
  }

  @Delete('campuses/:id')
  removeCampus(@Param('id') id: string) {
    return this.institutionService.removeCampus(+id);
  }
}
