import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { GradesService } from './grades.service';
import { GradeChangeAuditService } from './grade-change-audit.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { RectifyGradeRegistryDto } from './dto/rectify-grade-registry.dto';
import { SaveGradeRegistryDto } from './dto/grade-registry.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';

type AuthRequest = Request & { user?: RequestUser };

@Controller('grades')
@RequirePermiso('evaluacion.ver')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly gradeChangeAudit: GradeChangeAuditService,
  ) {}

  @Get('registry/contexts')
  listRegistryContexts(@Query('bimestre') bimestre?: string, @Req() req?: AuthRequest) {
    return this.gradesService.listRegistryContexts(
      bimestre ? +bimestre : 2,
      institutionIdDeAlcance(req?.user, req),
    );
  }

  @Get('registry')
  getRegistry(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('curso') curso: string,
    @Query('bimestre') bimestre: string,
    @Req() req?: AuthRequest,
  ) {
    return this.gradesService.getRegistry({
      nivel,
      grado,
      seccion,
      curso,
      bimestre: +bimestre,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get('registry/rectify/context')
  @RequirePermiso('evaluacion.rectificar', 'evaluacion.aprobar', 'evaluacion.reportes')
  getRectifyContext(
    @Query('bimestre') bimestre: string,
    @Req() req: AuthRequest,
  ) {
    return this.gradesService.getRectifyContext(
      bimestre ? +bimestre : 2,
      req.user,
      institutionIdDeAlcance(req.user, req),
    );
  }

  @Post('registry/bulk')
  @RequirePermiso('evaluacion.registrar', 'evaluacion.editar')
  saveRegistryBulk(@Body() dto: SaveGradeRegistryDto, @Req() req: AuthRequest) {
    return this.gradesService.saveRegistryBulk(dto, {
      req,
      motivo: dto.auditMotivo,
    }, institutionIdDeAlcance(req.user, req));
  }

  @Post('registry/rectify')
  @RequirePermiso('evaluacion.rectificar', 'evaluacion.aprobar')
  saveRegistryRectify(
    @Body() dto: RectifyGradeRegistryDto,
    @Req() req: AuthRequest,
  ) {
    return this.gradesService.saveRegistryRectify(
      dto,
      { req },
      institutionIdDeAlcance(req.user, req),
      req.user,
    );
  }

  @Get('change-audit/context')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  getChangeAuditContext() {
    return this.gradeChangeAudit.getContext();
  }

  @Get('change-audit/export')
  @RequirePermiso('evaluacion.exportar', 'admin.reportes')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="auditoria_notas.csv"',
  )
  exportChangeAuditCsv(
    @Query('studentId') studentId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
    @Query('accion') accion?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('resultado') resultado?: string,
  ) {
    return this.gradeChangeAudit.exportCsv({
      studentId: studentId ? +studentId : undefined,
      gradeId: gradeId ? +gradeId : undefined,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
      accion,
      usuario,
      desde,
      hasta,
      busqueda,
      resultado,
    });
  }

  @Get('change-audit')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  findChangeAudit(
    @Query('studentId') studentId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
    @Query('accion') accion?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('resultado') resultado?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.gradeChangeAudit.findAll({
      studentId: studentId ? +studentId : undefined,
      gradeId: gradeId ? +gradeId : undefined,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
      accion,
      usuario,
      desde,
      hasta,
      busqueda,
      resultado,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('change-audit/:logId')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  findChangeAuditOne(@Param('logId') logId: string) {
    return this.gradeChangeAudit.findOne(+logId);
  }

  @Get('averages')
  @RequirePermiso('evaluacion.reportes', 'evaluacion.ver')
  computeAverages(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('curso') curso?: string,
    @Query('busqueda') busqueda?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.gradesService.computeAverages({
      nivel,
      grado,
      seccion,
      curso,
      busqueda,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Post()
  @RequirePermiso('evaluacion.registrar')
  create(@Body() createGradeDto: CreateGradeDto, @Req() req: AuthRequest) {
    return this.gradesService.create(createGradeDto, {
      req,
      motivo: 'Registro individual de nota',
    }, institutionIdDeAlcance(req.user, req));
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.gradesService.findAll({
      studentId: studentId ? +studentId : undefined,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get(':id/change-audit')
  @RequirePermiso('evaluacion.reportes', 'admin.reportes')
  findGradeChangeAudit(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.gradeChangeAudit.findByGrade(+id, page ? +page : undefined, pageSize ? +pageSize : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.gradesService.findOne(+id, institutionIdDeAlcance(req.user, req));
  }

  @Patch(':id')
  @RequirePermiso('evaluacion.editar')
  update(
    @Param('id') id: string,
    @Body() updateGradeDto: UpdateGradeDto,
    @Req() req: AuthRequest,
  ) {
    return this.gradesService.update(+id, updateGradeDto, {
      req,
      motivo: 'Actualización individual de nota',
    }, institutionIdDeAlcance(req.user, req));
  }

  @Delete(':id')
  @RequirePermiso('evaluacion.editar')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.gradesService.remove(+id, {
      req,
      motivo: 'Eliminación de nota',
    }, institutionIdDeAlcance(req.user, req));
  }
}
