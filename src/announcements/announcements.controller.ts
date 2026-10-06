import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';

type AuthRequest = { user?: RequestUser };

@Controller('announcements')
@RequirePermiso('comunicados.ver')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @RequirePermiso('comunicados.enviar')
  create(@Body() createAnnouncementDto: CreateAnnouncementDto, @Req() req: AuthRequest) {
    return this.announcementsService.create(createAnnouncementDto, institutionIdDeAlcance(req.user, req));
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.announcementsService.findAll(institutionIdDeAlcance(req.user, req));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.announcementsService.findOne(+id, institutionIdDeAlcance(req.user, req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @Req() req: AuthRequest,
  ) {
    return this.announcementsService.update(+id, updateAnnouncementDto, institutionIdDeAlcance(req.user, req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.announcementsService.remove(+id, institutionIdDeAlcance(req.user, req));
  }
}
