import {
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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { institutionIdDeAlcance } from '../../auth/siagie-access.util';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import {
  CreateMaestroFormulaEvaluacionDto,
  UpdateMaestroFormulaEvaluacionDto,
} from './dto/maestro-formula-evaluacion.dto';
import { FormulasEvaluacionMaestrosService } from './formulas-evaluacion.service';
import { MaestrosAuthRequest } from '../common/maestros-tenant.util';

@Controller('maestros/formulas-evaluacion')
@UseGuards(JwtAuthGuard)
export class FormulasEvaluacionMaestrosController {
  constructor(
    private readonly formulasService: FormulasEvaluacionMaestrosService,
  ) {}

  @Get()
  findAll(@Req() req?: Request) {
    return this.formulasService.findAll(req as MaestrosAuthRequest);
  }

  @Get('resolve')
  resolve(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
    @Req() req?: Request & { user?: RequestUser },
  ) {
    return this.formulasService.resolve({
      nivel,
      grado,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
      institutionId: institutionIdDeAlcance(req?.user, req),
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req?: Request) {
    return this.formulasService.findOne(id, req as MaestrosAuthRequest);
  }

  @Post()
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroFormulaEvaluacionDto, @Req() req: Request) {
    return this.formulasService.create(dto, req as MaestrosAuthRequest);
  }

  @Patch(':id')
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroFormulaEvaluacionDto,
    @Req() req: Request,
  ) {
    return this.formulasService.update(id, dto, req as MaestrosAuthRequest);
  }

  @Delete(':id')
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.formulasService.remove(id, req as MaestrosAuthRequest);
  }
}
