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

  create(createAnnouncementDto: CreateAnnouncementDto, institutionId?: number) {
    const entity = this.announcementsRepository.create({
      ...createAnnouncementDto,
      institutionId: institutionId ?? null,
    });
    return this.announcementsRepository.save(entity);
  }

  findAll(institutionId?: number) {
    return this.announcementsRepository.find({
      where: institutionId === undefined ? {} : { institutionId },
      order: { fechaPublicacion: 'DESC' },
    });
  }

  findOne(id: number, institutionId?: number) {
    return this.getOrFail(id, institutionId);
  }

  async update(id: number, updateAnnouncementDto: UpdateAnnouncementDto, institutionId?: number) {
    const current = await this.getOrFail(id, institutionId);
    const merged = this.announcementsRepository.merge(current, updateAnnouncementDto);
    return this.announcementsRepository.save(merged);
  }

  async remove(id: number, institutionId?: number) {
    const current = await this.getOrFail(id, institutionId);
    await this.announcementsRepository.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number, institutionId?: number): Promise<Announcement> {
    const announcement = await this.announcementsRepository.findOneBy({ id });
    if (!announcement || (institutionId !== undefined && announcement.institutionId !== institutionId)) {
      throw new NotFoundException(`Announcement ${id} no encontrado`);
    }
    return announcement;
  }
}
