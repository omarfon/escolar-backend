import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AssignWaitlistDto,
  CreateWaitlistDto,
  UpdateWaitlistDto,
} from './dto/waitlist.dto';
import { WaitlistService } from './waitlist.service';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('waitlist')
@RequirePermiso('matricula.ver', 'matricula.vacantes')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get()
  findAll(
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('estado') estado?: string,
    @Query('prioridad') prioridad?: string,
  ) {
    return this.waitlistService.findAll({ nivel, grado, estado, prioridad });
  }

  @Post()
  create(@Body() dto: CreateWaitlistDto) {
    return this.waitlistService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWaitlistDto) {
    return this.waitlistService.update(+id, dto);
  }

  @Patch(':id/notify')
  notify(@Param('id') id: string) {
    return this.waitlistService.notify(+id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignWaitlistDto) {
    return this.waitlistService.assign(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.waitlistService.remove(+id);
  }
}
