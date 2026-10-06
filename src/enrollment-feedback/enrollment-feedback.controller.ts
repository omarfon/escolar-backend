import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { CreateEnrollmentFeedbackDto } from './dto/enrollment-feedback.dto';
import { EnrollmentFeedbackService } from './enrollment-feedback.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('enrollment-feedbacks')
@RequirePermiso('matricula.ver')
export class EnrollmentFeedbackController {
  constructor(
    private readonly enrollmentFeedbackService: EnrollmentFeedbackService,
  ) {}

  @Get('context')
  @RequirePermiso(
    'matricula.ver',
    'matricula.retroalimentacion',
    'matricula.exportar',
  )
  getContext() {
    return this.enrollmentFeedbackService.getContext();
  }

  @Get()
  @RequirePermiso(
    'matricula.ver',
    'matricula.retroalimentacion',
    'matricula.exportar',
  )
  findAll(
    @Query('enrollmentEvaluationId') enrollmentEvaluationId?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.enrollmentFeedbackService.findAll({
      enrollmentEvaluationId: enrollmentEvaluationId
        ? +enrollmentEvaluationId
        : undefined,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
      busqueda,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('evaluations/:id/eligibility')
  @RequirePermiso(
    'matricula.ver',
    'matricula.retroalimentacion',
    'matricula.exportar',
  )
  getEligibility(@Param('id') id: string) {
    return this.enrollmentFeedbackService.getEligibility(+id);
  }

  @Get(':id')
  @RequirePermiso(
    'matricula.ver',
    'matricula.retroalimentacion',
    'matricula.exportar',
  )
  findOne(@Param('id') id: string) {
    return this.enrollmentFeedbackService.findOne(+id);
  }

  @Post()
  @RequirePermiso('matricula.retroalimentacion')
  register(@Body() dto: CreateEnrollmentFeedbackDto, @Req() req: AuthRequest) {
    return this.enrollmentFeedbackService.register(dto, req);
  }
}
