import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import {
  esSuperusuarioSiagie,
  institutionIdDeAlcance,
} from '../auth/siagie-access.util';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { GradingConfigService } from './grading-config.service';
import { GradingScaleConfigService } from './grading-scale-config.service';
import { DEFAULT_GRADING_CONFIG } from './grading-config.types';
import {
  UpdateGradingScaleConfigDto,
  UpdateNivelEscalaDto,
} from './dto/grading-scale-config.dto';

type AuthRequest = Request & { user?: RequestUser };

@Controller('grading-config')
@UseGuards(JwtAuthGuard)
export class GradingConfigController {
  constructor(
    private readonly gradingConfigService: GradingConfigService,
    private readonly gradingScaleConfigService: GradingScaleConfigService,
  ) {}

  @Get()
  async getConfig(@Req() req: AuthRequest) {
    const institutionId = institutionIdDeAlcance(req.user, req);
    if (esSuperusuarioSiagie(req.user) && institutionId === undefined) {
      return DEFAULT_GRADING_CONFIG;
    }
    return this.gradingConfigService.getConfigForInstitution(institutionId);
  }

  @Get('context')
  @RequirePermiso('evaluacion.ver', 'evaluacion.configurar', 'admin.institucional')
  getContext(@Req() req: AuthRequest) {
    return this.gradingScaleConfigService.getContext(req.user, req as never);
  }

  @Get('history')
  @RequirePermiso('evaluacion.ver', 'evaluacion.configurar', 'admin.institucional')
  listHistory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.gradingScaleConfigService.listHistory(
      institutionIdDeAlcance(req?.user, req),
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }

  @Patch()
  @RequirePermiso('evaluacion.configurar', 'admin.institucional')
  updateScale(@Body() dto: UpdateGradingScaleConfigDto, @Req() req: AuthRequest) {
    return this.gradingScaleConfigService.updateInstitutionScale(
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Patch('nivel/:curriculumId')
  @RequirePermiso('evaluacion.configurar', 'admin.institucional', 'curricula.gestionar')
  updateNivelScale(
    @Param('curriculumId') curriculumId: string,
    @Body() dto: UpdateNivelEscalaDto,
    @Req() req: AuthRequest,
  ) {
    return this.gradingScaleConfigService.updateNivelScale(
      +curriculumId,
      dto,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }
}
