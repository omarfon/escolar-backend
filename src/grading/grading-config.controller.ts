import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GradingConfigService } from './grading-config.service';

@Controller('grading-config')
@UseGuards(JwtAuthGuard)
export class GradingConfigController {
  constructor(private readonly gradingConfigService: GradingConfigService) {}

  @Get()
  getConfig() {
    return this.gradingConfigService.getConfig();
  }
}
