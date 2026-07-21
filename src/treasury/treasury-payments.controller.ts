import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { PayVisaDto } from './dto/pay-visa.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { TreasuryService } from './treasury.service';
import { ChargeEstado } from './entities/student-charge.entity';

type AuthRequest = { user?: RequestUser };

@Controller('treasury')
@UseGuards(JwtAuthGuard)
export class TreasuryPaymentsController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('summary')
  @RequirePermiso('tesoreria.ver', 'tesoreria.registrar', 'tesoreria.reportes')
  @UseGuards(PermisoGuard)
  getSummary(@Query('anioEscolar') anioEscolar?: string) {
    const anio = anioEscolar ? Number(anioEscolar) : undefined;
    return this.treasuryService.getTreasurySummary(anio);
  }

  @Get('charges')
  @RequirePermiso('tesoreria.ver', 'tesoreria.registrar')
  @UseGuards(PermisoGuard)
  listCharges(
    @Query('anioEscolar') anioEscolar?: string,
    @Query('q') q?: string,
    @Query('estado') estado?: string,
  ) {
    const estadosValidos: ChargeEstado[] = [
      'pendiente',
      'parcial',
      'pagado',
      'vencido',
    ];
    const estadoValido = estadosValidos.includes(estado as ChargeEstado)
      ? (estado as ChargeEstado)
      : undefined;

    return this.treasuryService.findStaffCharges({
      anioEscolar: anioEscolar ? Number(anioEscolar) : undefined,
      q,
      estado: estadoValido,
    });
  }

  @Post('charges/:chargeId/payments')
  @RequirePermiso('tesoreria.registrar')
  @UseGuards(PermisoGuard)
  registerPayment(
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Body() dto: RegisterPaymentDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user!;
    const registradoPor =
      user.nombre?.trim() || user.username || 'Tesorería';
    return this.treasuryService.registerStaffPayment(
      chargeId,
      dto,
      registradoPor,
    );
  }

  @Post('charges/:chargeId/pay-visa')
  @RequirePermiso('tesoreria.registrar')
  @UseGuards(PermisoGuard)
  payWithVisa(
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Body() dto: PayVisaDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user!;
    const registradoPor =
      user.nombre?.trim() || user.username || 'Tesorería';
    return this.treasuryService.payChargeWithVisaStaff(
      chargeId,
      dto,
      registradoPor,
    );
  }

  @Get('payments/:paymentId/receipt')
  @RequirePermiso('tesoreria.ver', 'tesoreria.registrar')
  @UseGuards(PermisoGuard)
  getReceipt(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.treasuryService.getPaymentReceiptStaff(paymentId);
  }
}
