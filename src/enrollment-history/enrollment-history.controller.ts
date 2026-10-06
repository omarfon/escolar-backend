import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import type { EnrollmentHistoryActorContext } from './enrollment-history-actor.interface';
import { EnrollmentHistoryService } from './enrollment-history.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('enrollment-history')
@RequirePermiso('matricula.ver')
export class EnrollmentHistoryController {
  constructor(
    private readonly enrollmentHistoryService: EnrollmentHistoryService,
  ) {}

  @Get('context')
  @RequirePermiso('matricula.historial', 'matricula.ver', 'matricula.exportar')
  getContext(@Req() req: AuthRequest) {
    this.enrollmentHistoryService.logConsultation(req, 'listar');
    return this.enrollmentHistoryService.getContext(req);
  }

  @Get()
  @RequirePermiso('matricula.historial', 'matricula.ver', 'matricula.exportar')
  findAll(
    @Req() req: AuthRequest,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.enrollmentHistoryService.logConsultation(req, 'listar');
    return this.enrollmentHistoryService.findAll(
      q,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
      req,
    );
  }

  @Get(':studentId')
  @RequirePermiso('matricula.historial', 'matricula.ver', 'matricula.exportar')
  findOne(@Req() req: AuthRequest, @Param('studentId') studentId: string) {
    this.enrollmentHistoryService.logConsultation(req, 'detalle', studentId);
    return this.enrollmentHistoryService.findOne(+studentId, this.actor(req));
  }

  private actor(req: AuthRequest): EnrollmentHistoryActorContext {
    return {
      req,
      permisos: req.user?.permisos ?? [],
      ambitos: req.user?.ambitos ?? [],
      esAdmin: req.user?.esAdmin ?? false,
      institutionId: institutionIdDeAlcance(req.user, req) ?? null,
    };
  }
}
