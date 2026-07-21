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
  CreateMaestroSedeDto,
  UpdateMaestroSedeDto,
} from './dto/maestro-sede.dto';
import { SedesMaestrosService } from './sedes.service';

@Controller('maestros/sedes')
@UseGuards(JwtAuthGuard)
export class SedesMaestrosController {
  constructor(private readonly sedesService: SedesMaestrosService) {}

  @Get()
  findAll(@Query('institutionId') institutionId?: string) {
    return this.sedesService.findCatalog(
      institutionId ? +institutionId : undefined,
    );
  }

  @Post()
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  create(@Body() dto: CreateMaestroSedeDto) {
    return this.sedesService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaestroSedeDto,
  ) {
    return this.sedesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('admin.institucional', 'matricula.ver')
  @UseGuards(PermisoGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sedesService.remove(id);
  }
}
