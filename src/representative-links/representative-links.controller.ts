import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  AssociateStudentsDto,
  CeaseRepresentativeLinkDto,
  UpdateRepresentativeLinkDto,
} from './dto/representative-links.dto';
import { RepresentativeLinksService } from './representative-links.service';
import {
  PERMISO_VINCULOS_GESTIONAR,
  PERMISO_VINCULOS_VER,
} from './representative-links.constants';

type AuthRequest = Request & { user?: RequestUser };

@Controller('representative-links')
@RequirePermiso(PERMISO_VINCULOS_VER, 'estudiantes.expediente', 'estudiantes.editar')
export class RepresentativeLinksController {
  constructor(private readonly service: RepresentativeLinksService) {}

  @Get('context')
  getContext() {
    return this.service.getContext();
  }

  @Get('by-document')
  findByDocument(
    @Query('tipoDocumento') tipoDocumento?: string,
    @Query('numeroDocumento') numeroDocumento?: string,
  ) {
    return this.service.findByDocument(
      tipoDocumento ?? 'DNI',
      numeroDocumento ?? '',
    );
  }

  @Get('audit')
  findAudit(
    @Query('representativeId') representativeId?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAuditLogs({
      representativeId: representativeId ? Number(representativeId) : undefined,
      studentId: studentId ? Number(studentId) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('associate')
  @RequirePermiso(
    PERMISO_VINCULOS_GESTIONAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  associate(@Body() dto: AssociateStudentsDto, @Req() req: AuthRequest) {
    return this.service.associateStudents(
      dto,
      this.service.auditContextFromRequest(req),
    );
  }

  @Patch(':id')
  @RequirePermiso(
    PERMISO_VINCULOS_GESTIONAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRepresentativeLinkDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.updateLink(
      id,
      dto,
      this.service.auditContextFromRequest(req),
    );
  }

  @Post(':id/cessation')
  @RequirePermiso(
    PERMISO_VINCULOS_GESTIONAR,
    'estudiantes.editar',
    'matricula.editar',
  )
  cease(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CeaseRepresentativeLinkDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.ceaseLink(
      id,
      dto,
      this.service.auditContextFromRequest(req),
    );
  }
}
