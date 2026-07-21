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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import {
  CreateMaestroFormulaEvaluacionDto,
  UpdateMaestroFormulaEvaluacionDto,
} from './dto/maestro-formula-evaluacion.dto';
import { FormulasEvaluacionMaestrosService } from './formulas-evaluacion.service';

@Controller('maestros/formulas-evaluacion')
@UseGuards(JwtAuthGuard)
export class FormulasEvaluacionMaestrosController {
  constructor(
    private readonly formulasService: FormulasEvaluacionMaestrosService,
  ) {}

  @Get()
  findAll() {
    return this.formulasService.findAll();
  }

  @Get('resolve')
  resolve(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('curso') curso?: string,
    @Query('bimestre') bimestre?: string,
  ) {
    return this.formulasService.resolve({
      nivel,
      grado,
      curso,
      bimestre: bimestre ? +bimestre : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.formulasService.findOne(id);
  }

  @Post()
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroFormulaEvaluacionDto) {
    return this.formulasService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroFormulaEvaluacionDto,
  ) {
    return this.formulasService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('evaluacion.registrar', 'admin.institucional')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.formulasService.remove(id);
  }
}
