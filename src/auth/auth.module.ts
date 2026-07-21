import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermisoGuard } from './guards/permiso.guard';
import { RoleGuard } from './guards/role.guard';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [UsersModule, RolesModule, AuditLogsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PermisoGuard,
    RoleGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: PermisoGuard },
  ],
  exports: [AuthService, JwtAuthGuard, PermisoGuard, RoleGuard, RolesModule],
})
export class AuthModule {}

