import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';
import { UsersModule } from '../users/users.module';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, Institution]),
    UsersModule,
  ],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
