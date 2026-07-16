import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermisoGuard } from './guards/permiso.guard';

@Module({
  imports: [UsersModule, RolesModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermisoGuard],
  exports: [AuthService, JwtAuthGuard, PermisoGuard, RolesModule],
})
export class AuthModule {}
