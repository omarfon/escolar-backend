import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { RequestUser } from './interfaces/request-user.interface';

type AuthRequest = Request & { user?: RequestUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Get('me')
  getMe(@Req() req: AuthRequest) {
    return this.authService.getSession(+req.user!.id);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: string }, @Req() req: Request) {
    return this.authService.refreshFromToken(body.refreshToken ?? '', req);
  }
}

