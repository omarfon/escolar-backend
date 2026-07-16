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
import { ActasService } from './actas.service';
import { ApproveActaDto, GenerateActaDto } from './dto/acta.dto';

@Controller('actas')
export class ActasController {
  constructor(private readonly actasService: ActasService) {}

  @Get()
  findAll(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('bimestre') bimestre?: string,
    @Query('estado') estado?: string,
  ) {
    return this.actasService.findAll({
      nivel,
      grado,
      seccion,
      bimestre: bimestre ? +bimestre : undefined,
      estado,
    });
  }

  @Post('generate')
  generate(@Body() dto: GenerateActaDto) {
    return this.actasService.generate(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actasService.findOne(+id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveActaDto) {
    return this.actasService.approve(+id, dto);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.actasService.close(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actasService.remove(+id);
  }
}
