import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SaveCompetencyEvaluationsBulkDto } from './dto/competency-evaluation.dto';
import { CompetencyChangeAuditService } from './competency-change-audit.service';
import { CompetencyEvaluationsService } from './competency-evaluations.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';

type AuthRequest = Request & { user?: RequestUser };

@Controller('competency-evaluations')
@RequirePermiso('evaluacion.ver')
export class CompetencyEvaluationsController {
  constructor(
    private readonly competencyEvaluationsService: CompetencyEvaluationsService,
    private readonly changeAudit: CompetencyChangeAuditService,
  ) {}

  @Get('period-meta')
  getPeriodMeta() {
    return this.competencyEvaluationsService.getPeriodMeta();
  }

  @Get('registry/context')
  getRegistryContext(
    @Query('bimestre') bimestre: string,
    @Req() req: AuthRequest,
  ) {
    return this.competencyEvaluationsService.getRegistryContext(
      bimestre ? +bimestre : 2,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Get('change-audit/context')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  getChangeAuditContext() {
    return this.changeAudit.getContext();
  }

  @Get('change-audit')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  findChangeAudit(
    @Query('studentId') studentId?: string,
    @Query('competenciaId') competenciaId?: string,
    @Query('bimestre') bimestre?: string,
    @Query('accion') accion?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.changeAudit.findAll({
      studentId: studentId ? +studentId : undefined,
      competenciaId: competenciaId ? +competenciaId : undefined,
      bimestre: bimestre ? +bimestre : undefined,
      accion: accion || undefined,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('matrix')
  getMatrix(
    @Req() req: AuthRequest,
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
    @Query('curriculumId') curriculumId?: string,
    @Query('areaId') areaId?: string,
    @Query('cursoId') cursoId?: string,
  ) {
    return this.competencyEvaluationsService.getMatrix(
      {
        nivel,
        grado,
        seccion,
        bimestre: +bimestre,
        anio: anio ? +anio : undefined,
        curriculumId: curriculumId ? +curriculumId : undefined,
        areaId: areaId ? +areaId : undefined,
        cursoId: cursoId ? +cursoId : undefined,
      },
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Get('student/:studentId')
  getStudentProfile(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
    @Query('curriculumId') curriculumId?: string,
  ) {
    return this.competencyEvaluationsService.getStudentProfile(studentId, {
      bimestre: +bimestre,
      anio: anio ? +anio : undefined,
      curriculumId: curriculumId ? +curriculumId : undefined,
    });
  }

  @Post('bulk')
  @RequirePermiso('evaluacion.registrar', 'evaluacion.editar')
  saveBulk(@Req() req: AuthRequest, @Body() dto: SaveCompetencyEvaluationsBulkDto) {
    return this.competencyEvaluationsService.saveBulk(
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }
}
