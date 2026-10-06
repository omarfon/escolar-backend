import {
  BadRequestException,
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
} from '@nestjs/common';
import type { Request } from 'express';
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
import {
  PERMISOS_CURRICULA_GESTION,
  PERMISOS_CURRICULA_LECTURA,
} from './curricula.constants';
import { scopeFromCurriculaRequest } from './curricula-scope.util';

type AuthRequest = Request;

@Controller('curricula')
@RequirePermiso(...PERMISOS_CURRICULA_LECTURA)
export class CurriculaController {
  constructor(private readonly curriculaService: CurriculaService) {}

  @Get('catalog')
  getCatalog(
    @Req() req: AuthRequest,
    @Query('curriculumId') curriculumId?: string,
    @Query('nivel') nivel?: string,
    @Query('anio') anio?: string,
  ) {
    return this.curriculaService.getCatalog(
      curriculumId ? Number(curriculumId) : undefined,
      nivel,
      anio ? Number(anio) : undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('vigente')
  getVigente(
    @Req() req: AuthRequest,
    @Query('nivel') nivel: string,
    @Query('anio') anio?: string,
  ) {
    if (!nivel?.trim()) {
      throw new BadRequestException('Debe indicar el nivel educativo');
    }
    return this.curriculaService.resolveVigenteCurriculum(
      nivel.trim(),
      anio ? Number(anio) : undefined,
      undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('vigente/catalog')
  getCatalogVigente(
    @Req() req: AuthRequest,
    @Query('nivel') nivel: string,
    @Query('anio') anio?: string,
  ) {
    if (!nivel?.trim()) {
      throw new BadRequestException('Debe indicar el nivel educativo');
    }
    return this.curriculaService.getCatalogVigente(
      nivel.trim(),
      anio ? Number(anio) : undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('vigente/malla')
  getMallaVigente(
    @Req() req: AuthRequest,
    @Query('nivel') nivel: string,
    @Query('anio') anio?: string,
  ) {
    if (!nivel?.trim()) {
      throw new BadRequestException('Debe indicar el nivel educativo');
    }
    return this.curriculaService.getMallaVigente(
      nivel.trim(),
      anio ? Number(anio) : undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('vigentes')
  findVigentes(@Req() req: AuthRequest, @Query('anio') anio?: string) {
    const anioEscolar = anio ? Number(anio) : new Date().getFullYear();
    return this.curriculaService.findVigentesPorAnio(
      anioEscolar,
      undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('areas/context')
  getAreasContext(@Req() req: AuthRequest, @Query('anio') anio?: string) {
    return this.curriculaService.getAreasContext(
      anio ? Number(anio) : undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get()
  findCurriculas(
    @Req() req: AuthRequest,
    @Query('anio') anio?: string,
    @Query('nivel') nivel?: string,
    @Query('estado') estado?: string,
  ) {
    return this.curriculaService.findCurriculas(
      {
        anio: anio ? Number(anio) : undefined,
        nivel,
        estado,
      },
      scopeFromCurriculaRequest(req),
    );
  }

  @Post()
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  createCurriculum(@Req() req: AuthRequest, @Body() dto: CreateCurriculumDto) {
    return this.curriculaService.createCurriculum(dto, scopeFromCurriculaRequest(req));
  }

  @Patch(':id')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  updateCurriculum(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumDto,
  ) {
    return this.curriculaService.updateCurriculum(id, dto, scopeFromCurriculaRequest(req));
  }

  @Get(':id/summary')
  getSummary(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.getCurriculumSummary(id, scopeFromCurriculaRequest(req));
  }

  @Get(':id/malla')
  getMalla(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.getMalla(id, scopeFromCurriculaRequest(req));
  }

  @Post(':id/copy')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  copyCurriculum(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.curriculaService.copyCurriculum(id, scopeFromCurriculaRequest(req));
  }

  @Get('areas/list')
  findAreas(
    @Req() req: AuthRequest,
    @Query('curriculumId') curriculumId?: string,
  ) {
    return this.curriculaService.findAreas(
      curriculumId ? Number(curriculumId) : undefined,
      scopeFromCurriculaRequest(req),
    );
  }

  @Post('areas')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  createArea(@Body() dto: CreateCurriculumAreaDto, @Req() req: AuthRequest) {
    return this.curriculaService.createArea(dto, scopeFromCurriculaRequest(req));
  }

  @Patch('areas/:id')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  updateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumAreaDto,
    @Req() req: AuthRequest,
  ) {
    return this.curriculaService.updateArea(id, dto, scopeFromCurriculaRequest(req));
  }

  @Get('subjects/list')
  findSubjects(@Query('curriculumId') curriculumId?: string) {
    return this.curriculaService.findSubjects(
      curriculumId ? Number(curriculumId) : undefined,
    );
  }

  @Post('subjects')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  createSubject(@Body() dto: CreateCurriculumSubjectDto) {
    return this.curriculaService.createSubject(dto);
  }

  @Patch('subjects/:id')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurriculumSubjectDto,
  ) {
    return this.curriculaService.updateSubject(id, dto);
  }

  @Get('asignacion/context')
  getAsignacionContext(
    @Req() req: AuthRequest,
    @Query('anio') anio?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.curriculaService.getAsignacionContext(
      anio ? Number(anio) : new Date().getFullYear(),
      nivel,
      scopeFromCurriculaRequest(req),
    );
  }

  @Get('assignments/list')
  findAssignments(@Query('curriculumId') curriculumId?: string) {
    return this.curriculaService.findAssignments(
      curriculumId ? Number(curriculumId) : undefined,
    );
  }

  @Post('assignments')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  createAssignment(
    @Req() req: AuthRequest,
    @Body() dto: CreateTeacherAssignmentDto,
  ) {
    return this.curriculaService.createAssignment(
      dto,
      scopeFromCurriculaRequest(req),
    );
  }

  @Patch('assignments/:id')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  updateAssignment(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherAssignmentDto,
  ) {
    return this.curriculaService.updateAssignment(
      id,
      dto,
      scopeFromCurriculaRequest(req),
    );
  }

  @Delete('assignments/:id')
  @RequirePermiso(...PERMISOS_CURRICULA_GESTION)
  deleteAssignment(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.curriculaService.deleteAssignment(
      id,
      scopeFromCurriculaRequest(req),
    );
  }
}
