import { Controller, Get, Query, Req } from '@nestjs/common';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { DashboardService } from './dashboard.service';

type AuthRequest = { user?: RequestUser };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermiso('dashboard.ver')
  getStats(@Query('anioEscolar') anioEscolar?: string, @Req() req?: AuthRequest) {
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.dashboardService.getStats(anio, institutionIdDeAlcance(req?.user, req));
  }
}
