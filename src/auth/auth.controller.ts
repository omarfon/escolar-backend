import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { RequestUser } from './interfaces/request-user.interface';
import { PasswordRecoveryService } from './password-recovery.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type AuthRequest = Request & { user?: RequestUser };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Get('me')
  getMe(@Req() req: AuthRequest) {
    return this.authService.getSession(+req.user!.id);
  }

  @Public()
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: string }, @Req() req: Request) {
    return this.authService.refreshFromToken(body.refreshToken ?? '', req);
  }

  @Public()
  @Get('password-recovery/context')
  getPasswordRecoveryContext() {
    return this.passwordRecoveryService.getRecoveryContext();
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.passwordRecoveryService.forgotPassword(dto, req, idempotencyKey);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.passwordRecoveryService.resetPassword(dto, req);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthRequest) {
    return this.passwordRecoveryService.changePassword(+req.user!.id, dto, req);
  }

  @Post('logout')
  logout(@Req() req: AuthRequest) {
    return this.authService.logout(req);
  }
}
