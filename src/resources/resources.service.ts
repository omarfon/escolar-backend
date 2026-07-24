import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import {
  ResourceTipo,
  TeacherResource,
} from './entities/teacher-resource.entity';

export interface ResourceResponse {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: ResourceTipo;
  courseId: number | null;
  curso: string;
  nivel: string;
  grado: string;
  seccion: string;
  docente: string;
  fechaPublicacion: string;
  fechaEntrega: string | null;
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  visible: boolean;
  fechaPublicacionDisplay: string;
  fechaEntregaDisplay: string | null;
  tareasGeneradas: number;
}

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(TeacherResource)
    private readonly resourcesRepo: Repository<TeacherResource>,
    @InjectRepository(Task)
    private readonly tasksRepo: Repository<Task>,
    private readonly tasksService: TasksService,
  ) {}

  async create(dto: CreateResourceDto): Promise<ResourceResponse> {
    const saved = await this.resourcesRepo.save(
      this.resourcesRepo.create({
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() ?? '',
        tipo: dto.tipo as ResourceTipo,
        courseId: dto.courseId ?? null,
        curso: dto.curso.trim(),
        nivel: dto.nivel.trim(),
        grado: dto.grado.trim(),
        seccion: dto.seccion.trim(),
        docente: dto.docente?.trim() ?? 'Docente',
        fechaPublicacion: dto.fechaPublicacion,
        fechaEntrega: dto.fechaEntrega ?? null,
        url: dto.url?.trim() ?? '',
        nombreArchivo: dto.nombreArchivo?.trim() ?? '',
        mimeType: dto.mimeType?.trim() ?? '',
        tamanoBytes: dto.tamanoBytes ?? 0,
        visible: dto.visible ?? true,
      }),
    );

    const tareasGeneradas = await this.syncTasks(saved);
    return this.toResponse(saved, tareasGeneradas);
  }

  async findAll(query?: {
    curso?: string;
    tipo?: string;
    docente?: string;
    grado?: string;
    nivel?: string;
    seccion?: string;
    visible?: boolean;
  }): Promise<ResourceResponse[]> {
    const qb = this.resourcesRepo
      .createQueryBuilder('r')
      .orderBy('r.fechaPublicacion', 'DESC')
      .addOrderBy('r.createdAt', 'DESC');

    if (query?.curso) qb.andWhere('r.curso = :curso', { curso: query.curso });
    if (query?.tipo) qb.andWhere('r.tipo = :tipo', { tipo: query.tipo });
    if (query?.docente) qb.andWhere('r.docente ILIKE :docente', { docente: `%${query.docente}%` });
    if (query?.grado) qb.andWhere('r.grado = :grado', { grado: query.grado });
    if (query?.nivel) qb.andWhere('r.nivel = :nivel', { nivel: query.nivel });
    if (query?.seccion) {
      qb.andWhere('UPPER(TRIM(r.seccion)) = :seccion', {
        seccion: query.seccion.trim().toUpperCase(),
      });
    }
    if (query?.visible !== undefined) {
      qb.andWhere('r.visible = :visible', { visible: query.visible });
    }

    const rows = await qb.getMany();
    return Promise.all(rows.map((row) => this.toResponse(row)));
  }

  async findOne(id: number): Promise<ResourceResponse> {
    const resource = await this.getOrFail(id);
    return this.toResponse(resource);
  }

  async update(id: number, dto: UpdateResourceDto): Promise<ResourceResponse> {
    const current = await this.getOrFail(id);
    if (dto.titulo !== undefined) current.titulo = dto.titulo.trim();
    if (dto.descripcion !== undefined) current.descripcion = dto.descripcion.trim();
    if (dto.tipo !== undefined) current.tipo = dto.tipo as ResourceTipo;
    if (dto.fechaPublicacion !== undefined) {
      current.fechaPublicacion = dto.fechaPublicacion;
    }
    if (dto.fechaEntrega !== undefined) {
      current.fechaEntrega = dto.fechaEntrega || null;
    }
    if (dto.url !== undefined) current.url = dto.url.trim();
    if (dto.nombreArchivo !== undefined) {
      current.nombreArchivo = dto.nombreArchivo.trim();
    }
    if (dto.mimeType !== undefined) current.mimeType = dto.mimeType.trim();
    if (dto.tamanoBytes !== undefined) current.tamanoBytes = dto.tamanoBytes;
    if (dto.visible !== undefined) current.visible = dto.visible;

    const saved = await this.resourcesRepo.save(current);
    const tareasGeneradas = await this.syncTasks(saved);
    return this.toResponse(saved, tareasGeneradas);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.resourcesRepo.remove(current);
    return { deleted: true, id };
  }

  private async syncTasks(resource: TeacherResource): Promise<number> {
    return this.tasksService.syncTasksForResource(resource.id);
  }

  private async toResponse(
    resource: TeacherResource,
    tareasGeneradas?: number,
  ): Promise<ResourceResponse> {
    let count = tareasGeneradas;
    if (count === undefined && (resource.tipo === 'tarea' || resource.tipo === 'evaluacion')) {
      count = await this.tasksRepo.count({
        where: { titulo: resource.titulo, curso: resource.curso },
      });
    }

    return {
      id: resource.id,
      titulo: resource.titulo,
      descripcion: resource.descripcion,
      tipo: resource.tipo,
      courseId: resource.courseId,
      curso: resource.curso,
      nivel: resource.nivel,
      grado: resource.grado,
      seccion: resource.seccion,
      docente: resource.docente,
      fechaPublicacion: resource.fechaPublicacion,
      fechaEntrega: resource.fechaEntrega,
      url: resource.url,
      nombreArchivo: resource.nombreArchivo,
      mimeType: resource.mimeType ?? '',
      tamanoBytes: resource.tamanoBytes ?? 0,
      visible: resource.visible,
      fechaPublicacionDisplay: formatDate(resource.fechaPublicacion),
      fechaEntregaDisplay: resource.fechaEntrega
        ? formatDate(resource.fechaEntrega)
        : null,
      tareasGeneradas: count ?? 0,
    };
  }

  private async getOrFail(id: number): Promise<TeacherResource> {
    const resource = await this.resourcesRepo.findOneBy({ id });
    if (!resource) throw new NotFoundException(`Recurso ${id} no encontrado`);
    return resource;
  }
}

function formatDate(value: string): string {
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}
