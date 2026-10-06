import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { AuditLoggerService } from './audit-logger.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { RequestUser } from '../auth/interfaces/request-user.interface';

type AuthRequest = Request & { user?: RequestUser };

function resolveAuditScope(req: AuthRequest): number | null {
  const id = institutionIdDeAlcance(req.user, req);
  if (id == null || id < 1) return null;
  return id;
}

@Controller('audit-logs')
@RequirePermiso('admin.reportes')
export class AuditLogsController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @Get('context')
  getContext(@Req() req: AuthRequest) {
    const institutionId = resolveAuditScope(req) ?? undefined;
    return this.auditLogsService.getContext(institutionId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria_accesos.csv"')
  async exportCsv(
    @Req() req: AuthRequest,
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('nivel') nivel?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('tipo') tipo?: string,
    @Query('resultado') resultado?: string,
  ) {
    const institutionId = resolveAuditScope(req);
    if (institutionId == null) {
      throw new NotFoundException(
        'Seleccione una institución educativa para exportar la bitácora',
      );
    }

    const csv = await this.auditLogsService.exportCsv({
      institutionId,
      modulo,
      accion,
      nivel,
      usuario,
      desde,
      hasta,
      busqueda,
      tipo,
      resultado,
    });

    this.auditLogger.logFromRequestContext(req, {
      accion: 'exportar',
      modulo: 'administracion',
      entidad: 'bitacora',
      descripcion: 'Exportó bitácora de accesos a CSV',
      institutionId,
      detalle: {
        tipo: tipo ?? 'todos',
        filtros: { modulo, accion, nivel, usuario, desde, hasta, resultado },
      },
    });

    return csv;
  }

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('nivel') nivel?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
    @Query('tipo') tipo?: string,
    @Query('resultado') resultado?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const institutionId = resolveAuditScope(req);
    if (institutionId == null) {
      return {
        resumen: {
          total: 0,
          hoy: 0,
          criticos: 0,
          advertencias: 0,
          accesos: 0,
          accesosFallidos: 0,
          porModulo: [],
        },
        items: [],
        pagination: {
          page: 1,
          pageSize: pageSize ? +pageSize : 50,
          totalItems: 0,
          totalPages: 1,
        },
      };
    }

    return this.auditLogsService.findAll({
      institutionId,
      modulo,
      accion,
      nivel,
      usuario,
      desde,
      hasta,
      busqueda,
      tipo,
      resultado,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const institutionId = resolveAuditScope(req);
    if (institutionId == null) {
      throw new NotFoundException(`Registro de bitácora ${id} no encontrado`);
    }
    return this.auditLogsService.findOne(+id, institutionId);
  }

  /** Registros append-only: no se permiten altas manuales vía API. */
  @Post()
  createManualBlocked() {
    return this.auditLogsService.assertAppendOnlyApi();
  }
}
