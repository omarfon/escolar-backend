import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { CreateEnrollmentEvaluationDto } from './dto/enrollment-evaluation.dto';
import { EnrollmentEvaluationService } from './enrollment-evaluation.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('enrollment-evaluations')
@RequirePermiso('matricula.ver')
export class EnrollmentEvaluationController {
  constructor(
    private readonly enrollmentEvaluationService: EnrollmentEvaluationService,
  ) {}

  /**
   * OpenAPI: GET /enrollment-evaluations/context
   */
  @Get('context')
  @RequirePermiso('matricula.ver', 'matricula.evaluacion', 'matricula.exportar')
  getContext() {
    return this.enrollmentEvaluationService.getContext();
  }

  /**
   * OpenAPI: GET /enrollment-evaluations
   */
  @Get()
  @RequirePermiso('matricula.ver', 'matricula.evaluacion', 'matricula.exportar')
  findAll(
    @Query('waitlistEntryId') waitlistEntryId?: string,
    @Query('studentId') studentId?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Query('resultado') resultado?: string,
    @Query('tipoEvaluacion') tipoEvaluacion?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.enrollmentEvaluationService.findAll({
      waitlistEntryId: waitlistEntryId ? +waitlistEntryId : undefined,
      studentId: studentId ? +studentId : undefined,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      resultado,
      tipoEvaluacion,
      busqueda,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  /**
   * OpenAPI: GET /enrollment-evaluations/waitlist/:id/eligibility
   */
  @Get('waitlist/:id/eligibility')
  @RequirePermiso('matricula.ver', 'matricula.evaluacion', 'matricula.exportar')
  getWaitlistEligibility(@Param('id') id: string) {
    return this.enrollmentEvaluationService.getWaitlistEligibility(+id);
  }

  /**
   * OpenAPI: GET /enrollment-evaluations/students/:id/eligibility
   */
  @Get('students/:id/eligibility')
  @RequirePermiso('matricula.ver', 'matricula.evaluacion', 'matricula.exportar')
  getStudentEligibility(@Param('id') id: string) {
    return this.enrollmentEvaluationService.getStudentEligibility(+id);
  }

  /**
   * OpenAPI: GET /enrollment-evaluations/:id
   */
  @Get(':id')
  @RequirePermiso('matricula.ver', 'matricula.evaluacion', 'matricula.exportar')
  findOne(@Param('id') id: string) {
    return this.enrollmentEvaluationService.findOne(+id);
  }

  /**
   * OpenAPI: POST /enrollment-evaluations
   * Idempotente vía header Idempotency-Key / X-Correlation-Id.
   */
  @Post()
  @RequirePermiso('matricula.evaluacion')
  register(
    @Body() dto: CreateEnrollmentEvaluationDto,
    @Req() req: AuthRequest,
  ) {
    return this.enrollmentEvaluationService.register(dto, req);
  }
}
