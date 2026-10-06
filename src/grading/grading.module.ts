import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { Curriculum } from '../curricula/entities/curriculum.entity';
import { Institution } from '../institution/entities/institution.entity';
import { GradingConfigController } from './grading-config.controller';
import { GradingConfigService } from './grading-config.service';
import { GradingScaleConfigService } from './grading-scale-config.service';
import { GradingScaleConfigHistory } from './entities/grading-scale-config-history.entity';

@Module({
  imports: [
    AuthModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([
      Institution,
      Curriculum,
      GradingScaleConfigHistory,
    ]),
  ],
  controllers: [GradingConfigController],
  providers: [GradingConfigService, GradingScaleConfigService],
  exports: [GradingConfigService, GradingScaleConfigService],
})
export class GradingModule {}
