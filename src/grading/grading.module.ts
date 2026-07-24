import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Institution } from '../institution/entities/institution.entity';
import { GradingConfigController } from './grading-config.controller';
import { GradingConfigService } from './grading-config.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Institution])],
  controllers: [GradingConfigController],
  providers: [GradingConfigService],
  exports: [GradingConfigService],
})
export class GradingModule {}
