import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Announcement } from './entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementsRepository: Repository<Announcement>,
  ) {}

  create(createAnnouncementDto: CreateAnnouncementDto) {
    const entity = this.announcementsRepository.create(createAnnouncementDto);
    return this.announcementsRepository.save(entity);
  }

  findAll() {
    return this.announcementsRepository.find({
      order: { fechaPublicacion: 'DESC' },
    });
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateAnnouncementDto: UpdateAnnouncementDto) {
    const current = await this.getOrFail(id);
    const merged = this.announcementsRepository.merge(current, updateAnnouncementDto);
    return this.announcementsRepository.save(merged);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.announcementsRepository.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<Announcement> {
    const announcement = await this.announcementsRepository.findOneBy({ id });
    if (!announcement) {
      throw new NotFoundException(`Announcement ${id} no encontrado`);
    }
    return announcement;
  }
}
