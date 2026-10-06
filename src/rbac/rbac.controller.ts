import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RbacService } from './rbac.service';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('context')
  @RequirePermiso('admin.roles', 'admin.usuarios', 'admin.reportes')
  getContext() {
    return this.rbacService.getContext();
  }

  @Get('audit')
  @RequirePermiso('admin.roles', 'admin.reportes')
  findAudit(
    @Query('entidad') entidad?: string,
    @Query('usuario') usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rbacService.findAudit({
      entidad,
      usuario,
      desde,
      hasta,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get('users/:id/effective-auth')
  @RequirePermiso('admin.usuarios', 'admin.roles')
  getEffectiveAuth(@Param('id') id: string) {
    return this.rbacService.getEffectiveAuth(+id);
  }
}
