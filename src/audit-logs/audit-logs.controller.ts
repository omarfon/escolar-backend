import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateAuditLogDto } from './dto/audit-log.dto';
import { AuditLogsService } from './audit-logs.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('audit-logs')
@RequirePermiso('admin.reportes')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post()
  create(@Body() dto: CreateAuditLogDto) {
    return this.auditLogsService.create(dto);
  }

  @Get()
  findAll(
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('nivel') nivel?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.auditLogsService.findAll({
      modulo,
      accion,
      nivel,
      usuario,
      desde,
      hasta,
      busqueda,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(+id);
  }
}
