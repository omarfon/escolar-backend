import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { DiagnosticChangeAuditService } from './diagnostic-change-audit.service';
import { DiagnosticEvaluationsService } from './diagnostic-evaluations.service';
import { SaveDiagnosticEvaluationsBulkDto } from './dto/diagnostic-evaluation.dto';

type AuthRequest = Request & { user?: RequestUser };

@Controller('diagnostic-evaluations')
@RequirePermiso('evaluacion.ver')
export class DiagnosticEvaluationsController {
  constructor(
    private readonly diagnosticService: DiagnosticEvaluationsService,
    private readonly changeAudit: DiagnosticChangeAuditService,
  ) {}

  @Get('registry/context')
  getRegistryContext(@Req() req: AuthRequest) {
    return this.diagnosticService.getRegistryContext(
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Get('registry')
  getRegistry(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('curso') curso: string,
    @Req() req: AuthRequest,
  ) {
    return this.diagnosticService.getRegistry({
      nivel,
      grado,
      seccion,
      curso,
      institutionId: institutionIdDeAlcance(req.user, req),
    });
  }

  @Post('bulk')
  @RequirePermiso('evaluacion.registrar', 'evaluacion.editar')
  saveBulk(@Body() dto: SaveDiagnosticEvaluationsBulkDto, @Req() req: AuthRequest) {
    return this.diagnosticService.saveBulk(
      dto,
      req,
      institutionIdDeAlcance(req.user, req),
      req.user,
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
    @Query('curso') curso?: string,
    @Query('accion') accion?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.changeAudit.findAll({
      studentId: studentId ? +studentId : undefined,
      curso: curso || undefined,
      accion: accion || undefined,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }
}
