import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Schedule } from './entities/schedule.entity';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
  ) {}

  create(createScheduleDto: CreateScheduleDto) {
    const entity = this.schedulesRepository.create(createScheduleDto);
    return this.schedulesRepository.save(entity);
  }

  findAll() {
    return this.schedulesRepository.find({
      order: { dia: 'ASC', horaInicio: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateScheduleDto: UpdateScheduleDto) {
    const current = await this.getOrFail(id);
    const merged = this.schedulesRepository.merge(current, updateScheduleDto);
    return this.schedulesRepository.save(merged);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.schedulesRepository.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<Schedule> {
    const schedule = await this.schedulesRepository.findOneBy({ id });
    if (!schedule) throw new NotFoundException(`Schedule ${id} no encontrado`);
    return schedule;
  }
}
