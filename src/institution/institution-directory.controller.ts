import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { SiagieGuard } from '../auth/guards/siagie.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CambiarCredencialInstitucionDto, EstadoUsuarioInstitucionDto } from './dto/institucion-personal.dto';
import { InstitutionDirectoryService } from './institution-directory.service';

type AuthRequest = { user?: RequestUser };

@Controller('institution-directory')
@UseGuards(SiagieGuard)
@RequirePermiso('estudiantes.ver', 'traslados.ver', 'matricula.ver')
export class InstitutionDirectoryController {
  constructor(private readonly directory: InstitutionDirectoryService) {}

  @Get()
  listInstitutions() {
    return this.directory.listInstitutions();
  }

  @Post()
  crear(@Body() dto: CreateInstitutionDto) {
    return this.directory.crearInstitucion(dto);
  }

  @Get(':institutionId/detalle')
  detalle(@Param('institutionId', ParseIntPipe) institutionId: number) {
    return this.directory.detalle(institutionId);
  }

  @Patch(':institutionId/personal/:userId/credenciales')
  credenciales(
    @Param('institutionId', ParseIntPipe) institutionId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CambiarCredencialInstitucionDto,
  ) {
    return this.directory.cambiarCredencial(institutionId, userId, dto.password);
  }

  @Patch(':institutionId/personal/:userId/estado')
  estado(
    @Param('institutionId', ParseIntPipe) institutionId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: EstadoUsuarioInstitucionDto,
  ) {
    return this.directory.cambiarEstado(institutionId, userId, dto.estado);
  }

  @Get(':institutionId/students')
  listStudents(
    @Param('institutionId', ParseIntPipe) institutionId: number,
    @Query('q') q = '',
    @Query('grado') grado = '',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: AuthRequest,
  ) {
    return this.directory.listStudents(
      institutionId,
      {
        q,
        grado,
        page: page ? +page : 1,
        pageSize: pageSize ? +pageSize : 10,
      },
      institutionIdDeAlcance(req?.user, req),
    );
  }

  @Get('students/:studentId')
  findPersona(@Param('studentId', ParseIntPipe) studentId: number, @Req() req: AuthRequest) {
    return this.directory.findPersona(studentId, institutionIdDeAlcance(req.user, req));
  }
}
