import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { ResourcesService } from './resources.service';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Get()
  findAll(
    @Query('curso') curso?: string,
    @Query('tipo') tipo?: string,
    @Query('docente') docente?: string,
    @Query('grado') grado?: string,
    @Query('visible') visible?: string,
  ) {
    return this.resourcesService.findAll({
      curso,
      tipo,
      docente,
      grado,
      visible: visible === 'true' ? true : visible === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(+id);
  }
}
