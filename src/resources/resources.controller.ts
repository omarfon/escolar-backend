import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateResourceDto,
  UpdateResourceDto,
  UpdateResourceVisibilityDto,
} from './dto/resource.dto';
import { ResourceTipo } from './entities/teacher-resource.entity';
import { saveResourceFile } from './resources-upload.util';
import { ResourcesService } from './resources.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('resources')
@RequirePermiso('comunicados.ver', 'evaluacion.ver')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post('upload')
  @RequirePermiso('comunicados.enviar', 'evaluacion.registrar', 'evaluacion.editar')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('tipo') tipo: string,
    @Body('nivel') nivel: string,
    @Body('grado') grado: string,
    @Body('seccion') seccion: string,
  ) {
    if (!tipo || !nivel || !grado || !seccion) {
      throw new BadRequestException('tipo, nivel, grado y seccion son requeridos');
    }
    return saveResourceFile(file, tipo as ResourceTipo, { nivel, grado, seccion });
  }

  @Post()
  @RequirePermiso('comunicados.enviar', 'evaluacion.registrar', 'evaluacion.editar')
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Get()
  findAll(
    @Query('curso') curso?: string,
    @Query('tipo') tipo?: string,
    @Query('docente') docente?: string,
    @Query('grado') grado?: string,
    @Query('nivel') nivel?: string,
    @Query('seccion') seccion?: string,
    @Query('visible') visible?: string,
  ) {
    return this.resourcesService.findAll({
      curso,
      tipo,
      docente,
      grado,
      nivel,
      seccion,
      visible: visible === 'true' ? true : visible === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(+id);
  }

  @Patch(':id/visibility')
  @RequirePermiso('comunicados.enviar', 'evaluacion.registrar', 'evaluacion.editar')
  setVisibility(@Param('id') id: string, @Body() dto: UpdateResourceVisibilityDto) {
    return this.resourcesService.update(+id, { visible: dto.visible });
  }

  @Patch(':id')
  @RequirePermiso('comunicados.enviar', 'evaluacion.registrar', 'evaluacion.editar')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(+id, dto);
  }

  @Delete(':id')
  @RequirePermiso('comunicados.enviar', 'evaluacion.registrar', 'evaluacion.editar')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(+id);
  }
}
