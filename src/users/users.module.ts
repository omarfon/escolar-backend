import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Role } from '../roles/entities/role.entity';
import { RolesModule } from '../roles/roles.module';
import { UserRoleAssignment } from './entities/user-role-assignment.entity';
import { User } from './entities/user.entity';
import { UserRolesService } from './user-roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRoleAssignment, Role]),
    RolesModule,
    AuditLogsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRolesService],
  exports: [UsersService, UserRolesService],
})
export class UsersModule {}
