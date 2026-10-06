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
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { esSuperusuarioSiagie, institutionIdDeAlcance } from '../../auth/siagie-access.util';
import { requireMaestrosInstitutionId } from '../common/maestros-tenant.util';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../../auth/guards/permiso.guard';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import {
  CreateMaestroSedeDto,
  UpdateMaestroSedeDto,
} from './dto/maestro-sede.dto';
import { SedesMaestrosService } from './sedes.service';

@Controller('maestros/sedes')
@UseGuards(JwtAuthGuard)
export class SedesMaestrosController {
  constructor(private readonly sedesService: SedesMaestrosService) {}

  @Get()
  findAll(
    @Query('institutionId') institutionId?: string,
    @Req() req?: { user?: RequestUser },
  ) {
    if (esSuperusuarioSiagie(req?.user)) {
      return institutionId
        ? this.sedesService.findCatalog(+institutionId)
        : this.sedesService.findTodas();
    }
    return this.sedesService.findCatalog(institutionIdDeAlcance(req?.user, req));
  }

  @Post()
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  create(
    @Body() dto: CreateMaestroSedeDto,
    @Req() req?: { user?: RequestUser },
  ) {
    const institutionId = requireMaestrosInstitutionId(req ?? {});
    return this.sedesService.create(dto, institutionId);
  }

  @Patch(':id')
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroSedeDto,
    @Req() req?: { user?: RequestUser },
  ) {
    const institutionId = requireMaestrosInstitutionId(req ?? {});
    return this.sedesService.update(id, dto, institutionId);
  }

  @Delete(':id')
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: { user?: RequestUser },
  ) {
    const institutionId = requireMaestrosInstitutionId(req ?? {});
    return this.sedesService.remove(id, institutionId);
  }
}
