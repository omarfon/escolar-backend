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
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  CreateTemarioClaseDto,
  UpdateTemarioClaseDto,
} from './dto/temario-clase.dto';
import { TemarioService } from './temario.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('temario')
export class TemarioController {
  constructor(private readonly temarioService: TemarioService) {}

  @Get('docente/clases')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  findDocenteClases(
    @Req() req: AuthRequest,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('curso') curso?: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.temarioService.findForDocente(+(req.user?.id ?? 0), {
      nivel,
      grado,
      seccion,
      curso,
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
    });
  }

  @Post('docente/clases')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  createDocenteClase(
    @Req() req: AuthRequest,
    @Body() dto: CreateTemarioClaseDto,
  ) {
    return this.temarioService.createForDocente(+(req.user?.id ?? 0), dto);
  }

  @Patch('docente/clases/:id')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  updateDocenteClase(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemarioClaseDto,
  ) {
    return this.temarioService.updateForDocente(+(req.user?.id ?? 0), id, dto);
  }

  @Delete('docente/clases/:id')
  @RequirePermiso()
  @RequireRole('DOCENTE')
  removeDocenteClase(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.temarioService.removeForDocente(+(req.user?.id ?? 0), id);
  }

  @Get('estudiante/clases')
  @RequirePermiso()
  @RequireRole('ESTUDIANTE')
  findEstudianteClases(
    @Req() req: AuthRequest,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
    @Query('curso') curso?: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.temarioService.findForEstudiante(+(req.user?.id ?? 0), {
      nivel,
      grado,
      seccion,
      curso,
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
    });
  }
}
