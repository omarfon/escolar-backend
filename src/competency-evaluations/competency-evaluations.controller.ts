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
import { SaveCompetencyEvaluationsBulkDto } from './dto/competency-evaluation.dto';
import { CompetencyEvaluationsService } from './competency-evaluations.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

type AuthRequest = { user?: RequestUser };

@Controller('competency-evaluations')
@RequirePermiso('evaluacion.ver')
export class CompetencyEvaluationsController {
  constructor(
    private readonly competencyEvaluationsService: CompetencyEvaluationsService,
  ) {}

  @Get('period-meta')
  getPeriodMeta() {
    return this.competencyEvaluationsService.getPeriodMeta();
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
    return this.competencyEvaluationsService.saveBulk(dto, req.user);
  }
}
