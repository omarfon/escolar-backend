import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { esSuperusuarioSiagie, institutionIdDeAlcance } from '../auth/siagie-access.util';
import { esAdminNacional } from '../roles/roles-rbac-visibility.util';
import { BulkImportUsersDto } from './dto/bulk-import-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserRoleAssignmentsDto } from './dto/user-role-assignment.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRolesService } from './user-roles.service';
import { UsersService } from './users.service';

type AuthedRequest = Request & { user?: RequestUser };

@Controller('users')
@RequirePermiso('admin.usuarios')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userRolesService: UserRolesService,
  ) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('bulk')
  bulkImport(@Body() dto: BulkImportUsersDto) {
    return this.usersService.bulkCreate(dto.usuarios);
  }

  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla_usuarios.csv"')
  getTemplate() {
    return '\uFEFF' + this.usersService.getImportTemplate();
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Get(':id/role-assignments')
  listRoleAssignments(@Param('id') id: string) {
    return this.userRolesService.listAssignments(+id);
  }

  @Put(':id/role-assignments')
  setRoleAssignments(
    @Param('id') id: string,
    @Body() dto: SetUserRoleAssignmentsDto,
    @Req() req: AuthedRequest,
  ) {
    const actor = req.user;
    return this.userRolesService.setAssignments(+id, dto, actor ? {
      id: +actor.id,
      nombre: actor.nombre ?? actor.username,
      rol: actor.roles[0] ?? '',
    } : undefined, {
      siagie: esSuperusuarioSiagie(actor),
      institutionId: institutionIdDeAlcance(actor, req),
      adminNacional: esAdminNacional(actor),
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(+id, dto);
  }

  @Patch(':id/toggle-estado')
  toggleEstado(@Param('id') id: string) {
    return this.usersService.toggleEstado(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
