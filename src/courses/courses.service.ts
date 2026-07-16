import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course } from './entities/course.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  create(createCourseDto: CreateCourseDto) {
    const entity = this.coursesRepository.create(createCourseDto);
    return this.coursesRepository.save(entity);
  }

  findAll() {
    return this.coursesRepository.find({
      order: { nivel: 'ASC', grado: 'ASC', seccion: 'ASC', nombre: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.getOrFail(id);
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const current = await this.getOrFail(id);
    const merged = this.coursesRepository.merge(current, updateCourseDto);
    return this.coursesRepository.save(merged);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.coursesRepository.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) throw new NotFoundException(`Course ${id} no encontrado`);
    return course;
  }
}
