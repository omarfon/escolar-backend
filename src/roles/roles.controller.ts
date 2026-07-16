import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Patch(':codigo/permissions')
  updatePermissions(
    @Param('codigo') codigo: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(codigo, dto.permisos);
  }
}
