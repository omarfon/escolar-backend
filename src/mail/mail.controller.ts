import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@Controller('mail')
@RequirePermiso('admin.institucional')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  getStatus() {
    return this.mailService.getStatus();
  }

  @Get('verify')
  async verify() {
    return this.mailService.verifyConnection();
  }

  @Post('test')
  async sendTest(@Body() dto: SendTestMailDto) {
    const to = dto.to?.trim() || this.mailService.getDefaultTestRecipient();
    try {
      const result = await this.mailService.sendTest(to);
      const verify = await this.mailService.verifyConnection();
      return { ...result, verify, to };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar correo de prueba';
      throw new BadRequestException(message);
    }
  }
}