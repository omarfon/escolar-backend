import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { esSuperusuarioSiagie, institutionIdDeAlcance } from '../auth/siagie-access.util';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolesService } from './roles.service';

type AuthRequest = Request & { user?: RequestUser };

@Controller('roles')
@RequirePermiso('admin.roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.rolesService.findAll(institutionIdDeAlcance(req.user, req));
  }

  @Post()
  create(@Body() dto: CreateRoleDto, @Req() req: AuthRequest) {
    const actor = req.user;
    return this.rolesService.create(
      dto,
      {
        siagie: esSuperusuarioSiagie(actor),
        institutionId: institutionIdDeAlcance(actor, req),
      },
      actor
        ? {
            id: +actor.id,
            nombre: actor.nombre ?? actor.username,
            rol: actor.roles[0] ?? '',
          }
        : undefined,
    );
  }

  @Patch(':codigo/permissions')
  updatePermissions(
    @Param('codigo') codigo: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Req() req: AuthRequest,
  ) {
    const actor = req.user;
    return this.rolesService.updatePermissions(
      codigo,
      dto.permisos,
      actor
        ? {
            id: +actor.id,
            nombre: actor.nombre ?? actor.username,
            rol: actor.roles[0] ?? '',
          }
        : undefined,
      dto.motivo,
      {
        siagie: esSuperusuarioSiagie(actor),
        institutionId: institutionIdDeAlcance(actor, req),
      },
    );
  }
}
