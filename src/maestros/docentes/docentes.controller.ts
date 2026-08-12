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
} from '@nestjs/common';
import { Request } from 'express';
import { RequirePermiso } from '../../auth/decorators/require-permiso.decorator';
import { RequireRole } from '../../auth/decorators/require-role.decorator';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { CreateDocenteDto, UpdateDocenteDto } from './dto/docente.dto';
import { UpdateMiPerfilDocenteDto } from './dto/update-mi-perfil-docente.dto';
import { DocentesMaestrosService } from './docentes.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('maestros/docentes')
@RequirePermiso('docentes.ver')
export class DocentesMaestrosController {
  constructor(private readonly docentesService: DocentesMaestrosService) {}

  @Get()
  findAll(
    @Query('estado') estado?: string,
    @Query('sede') sede?: string,
    @Query('busqueda') busqueda?: string,
    @Query('anioEscolar') anioEscolar?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query = {
      estado: estado || undefined,
      sede: sede || undefined,
      busqueda: busqueda || undefined,
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
    };
    return this.docentesService.findPaginated(
      query,
      page ? Math.max(1, Number(page)) : 1,
      pageSize ? Math.max(1, Number(pageSize)) : 10,
    );
  }

  @Get('me/perfil')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  getMiPerfil(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const userId = +(req.user?.id ?? 0);
    return this.docentesService.getMiPerfil(
      userId,
      req.user?.username,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Get('me/salones')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  findMySalones(
    @Req() req: { user: RequestUser },
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const userId = Number(req.user.id);
    return this.docentesService.findSalonesForUser(
      userId,
      req.user.username,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Get('me/mi-aula')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  getMiAula(
    @Req() req: AuthRequest,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const userId = +(req.user?.id ?? 0);
    return this.docentesService.getMiAula(
      userId,
      req.user?.username,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Patch('me/perfil')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  updateMiPerfil(
    @Req() req: AuthRequest,
    @Body() dto: UpdateMiPerfilDocenteDto,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    const userId = +(req.user?.id ?? 0);
    return this.docentesService.updateMiPerfil(
      userId,
      req.user?.username,
      dto,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.docentesService.findOne(
      id,
      anioEscolar ? Number(anioEscolar) : undefined,
    );
  }

  @Post()
  @RequirePermiso('docentes.crear', 'docentes.editar')
  create(@Body() dto: CreateDocenteDto) {
    return this.docentesService.create(dto);
  }

  @Patch(':id')
  @RequirePermiso('docentes.editar', 'docentes.crear')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocenteDto,
  ) {
    return this.docentesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermiso('docentes.editar')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.docentesService.remove(id);
  }
}
