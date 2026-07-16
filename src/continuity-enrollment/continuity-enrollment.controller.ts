import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContinuityEnrollmentService } from './continuity-enrollment.service';
import {
  ApproveAllContinuityDto,
  ApproveContinuityDto,
  GenerateContinuityDto,
  RejectContinuityDto,
} from './dto/continuity-enrollment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

@Controller('continuity-enrollment')
export class ContinuityEnrollmentController {
  constructor(private readonly continuityService: ContinuityEnrollmentService) {}

  @Get('candidates')
  findCandidates(
    @Query('anioOrigen') anioOrigen?: string,
    @Query('anioNuevo') anioNuevo?: string,
  ) {
    const origen = anioOrigen ? +anioOrigen : 2025;
    const nuevo = anioNuevo ? +anioNuevo : 2026;
    return this.continuityService.findCandidates(origen, nuevo);
  }

  @Get()
  findRecords(
    @Query('anioNuevo') anioNuevo?: string,
    @Query('estado') estado?: string,
  ) {
    const anio = anioNuevo ? +anioNuevo : 2026;
    return this.continuityService.findRecords(anio, estado);
  }

  @Post('generate')
  generate(@Body() dto: GenerateContinuityDto, @Req() req: { user?: RequestUser }) {
    const generadoPor =
      dto.generadoPor?.trim() ||
      req.user?.username ||
      'Administrador';
    return this.continuityService.generate({ ...dto, generadoPor });
  }

  @Post('approve-all')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequirePermiso('matricula.aprobar')
  approveAll(
    @Body() dto: ApproveAllContinuityDto,
    @Req() req: { user: RequestUser },
  ) {
    const aprobadoPor = dto.aprobadoPor?.trim() || req.user.username || 'Administrador';
    return this.continuityService.approveAll({ ...dto, aprobadoPor });
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequirePermiso('matricula.aprobar')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveContinuityDto,
    @Req() req: { user: RequestUser },
  ) {
    const aprobadoPor = dto.aprobadoPor?.trim() || req.user.username || 'Administrador';
    return this.continuityService.approve(+id, { ...dto, aprobadoPor });
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequirePermiso('matricula.aprobar')
  reject(@Param('id') id: string, @Body() dto: RejectContinuityDto) {
    return this.continuityService.reject(+id, dto);
  }
}
