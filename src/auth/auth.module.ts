import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermisoGuard } from './guards/permiso.guard';
import { RoleGuard } from './guards/role.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Institution } from '../institution/entities/institution.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordRecoveryService } from './password-recovery.service';
import { PasswordRecoveryRateLimiterService } from './password-recovery-rate-limiter.service';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([PasswordResetToken, Institution]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordRecoveryService,
    PasswordRecoveryRateLimiterService,
    JwtAuthGuard,
    PermisoGuard,
    RoleGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: PermisoGuard },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    PermisoGuard,
    RoleGuard,
    RolesModule,
    UsersModule,
  ],
})
export class AuthModule {}
