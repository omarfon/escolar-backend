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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import {
  CreatePaymentConceptDto,
  TogglePaymentConceptActivoDto,
  UpdatePaymentConceptDto,
} from './dto/payment-concept.dto';
import { TreasuryService } from './treasury.service';

@Controller('treasury/concepts')
@UseGuards(JwtAuthGuard)
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get()
  @RequirePermiso('tesoreria.ver', 'tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  findAll(
    @Query('tipo') tipo?: string,
    @Query('nivel') nivel?: string,
    @Query('activo') activo?: string,
    @Query('q') q?: string,
  ) {
    const tipoValido =
      tipo === 'obligatorio' || tipo === 'voluntario' || tipo === 'eventual'
        ? tipo
        : undefined;

    return this.treasuryService.findAllConcepts({
      tipo: tipoValido,
      nivel,
      activo:
        activo === undefined
          ? undefined
          : activo === 'true'
            ? true
            : activo === 'false'
              ? false
              : undefined,
      q,
    });
  }

  @Get(':id')
  @RequirePermiso('tesoreria.ver', 'tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.treasuryService.findConceptById(id);
  }

  @Post()
  @RequirePermiso('tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreatePaymentConceptDto) {
    return this.treasuryService.createConcept(dto);
  }

  @Patch(':id')
  @RequirePermiso('tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentConceptDto,
  ) {
    return this.treasuryService.updateConcept(id, dto);
  }

  @Patch(':id/activo')
  @RequirePermiso('tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  toggleActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TogglePaymentConceptActivoDto,
  ) {
    return this.treasuryService.setConceptActivo(id, dto.activo);
  }

  @Delete(':id')
  @RequirePermiso('tesoreria.conceptos')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.treasuryService.removeConcept(id);
  }
}
