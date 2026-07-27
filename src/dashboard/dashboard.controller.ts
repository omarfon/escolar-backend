import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermiso('dashboard.ver')
  getStats(@Query('anioEscolar') anioEscolar?: string) {
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.dashboardService.getStats(anio);
  }
}
