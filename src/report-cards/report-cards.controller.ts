import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  GenerateReportCardsDto,
  UpdateReportCardBodyDto,
} from './dto/report-card.dto';
import { ReportCardsService } from './report-cards.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('report-cards')
@RequirePermiso('evaluacion.ver')
export class ReportCardsController {
  constructor(private readonly reportCardsService: ReportCardsService) {}

  @Get()
  list(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
    @Query('estado') estado?: string,
  ) {
    return this.reportCardsService.list({
      nivel,
      grado,
      seccion,
      bimestre: +bimestre,
      anio: anio ? +anio : undefined,
      estado: (estado as 'todos') || 'todos',
    });
  }

  @Get('pdf/salon')
  async pdfSalon(
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
    @Query('studentIds') studentIds?: string,
    @Res() res?: Response,
  ) {
    const ids = studentIds
      ? studentIds.split(',').map((x) => +x.trim()).filter(Boolean)
      : undefined;
    const { buffer, filename } = await this.reportCardsService.pdfSalon({
      nivel,
      grado,
      seccion,
      bimestre: +bimestre,
      anio: anio ? +anio : undefined,
      studentIds: ids,
    });
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(buffer);
  }

  @Get(':studentId/pdf')
  async pdfOne(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
    @Res() res?: Response,
  ) {
    const { buffer, filename } = await this.reportCardsService.pdfOne(studentId, {
      nivel,
      grado,
      seccion,
      bimestre: +bimestre,
      anio: anio ? +anio : undefined,
    });
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(buffer);
  }

  @Get(':studentId')
  getOne(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('seccion') seccion: string,
    @Query('bimestre') bimestre: string,
    @Query('anio') anio?: string,
  ) {
    return this.reportCardsService.getOne(studentId, {
      nivel,
      grado,
      seccion,
      bimestre: +bimestre,
      anio: anio ? +anio : undefined,
    });
  }

  @Post('generate')
  generate(@Body() dto: GenerateReportCardsDto) {
    return this.reportCardsService.generate(dto);
  }

  @Patch(':studentId')
  update(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: UpdateReportCardBodyDto,
  ) {
    return this.reportCardsService.update(studentId, dto);
  }
}
