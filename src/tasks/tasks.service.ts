import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  create(createTaskDto: CreateTaskDto) {
    const entity = this.tasksRepository.create(createTaskDto);
    return this.tasksRepository.save(entity);
  }

  async findAll(studentId?: number) {
    const qb = this.tasksRepository
      .createQueryBuilder('t')
      .orderBy('t.fechaEntrega', 'ASC');

    if (studentId !== undefined) {
      qb.where('t.studentId = :studentId', { studentId });
    }

    const tasks = await qb.getMany();
    await this.applyOverdueStatus(tasks);
    return tasks;
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateTaskDto: UpdateTaskDto) {
    const current = await this.getOrFail(id);
    const merged = this.tasksRepository.merge(current, updateTaskDto);
    const saved = await this.tasksRepository.save(merged);
    await this.applyOverdueStatus([saved]);
    return saved;
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.tasksRepository.remove(current);
    return { deleted: true, id };
  }

  private async applyOverdueStatus(tasks: Task[]): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    for (const task of tasks) {
      if (task.estado === 'PENDING' && task.fechaEntrega < today) {
        task.estado = 'OVERDUE';
        await this.tasksRepository.save(task);
      }
    }
  }

  private async getOrFail(id: number): Promise<Task> {
    const task = await this.tasksRepository.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} no encontrado`);
    return task;
  }
}
