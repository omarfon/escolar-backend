import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  DocenteSalonDetalle,
  DocentesMaestrosService,
} from '../maestros/docentes/docentes.service';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import {
  ResourceTipo,
  TeacherResource,
} from '../resources/entities/teacher-resource.entity';
import { Student } from '../students/entities/student.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { GradeTaskDto } from './dto/grade-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskEstado } from './entities/task.entity';
import { saveTaskSubmissionFile } from './tasks-upload.util';

export interface TaskResourceEmbed {
  id: number;
  descripcion: string;
  tipo: ResourceTipo;
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  docente: string;
}

export interface PendingReviewTaskResponse extends TaskResponse {
  tareaTitulo: string;
  salonLabel: string;
}

export interface PendingReviewResponse {
  porCalificar: PendingReviewTaskResponse[];
  vencidasSinEntrega: PendingReviewTaskResponse[];
}

export interface TaskResponse {
  id: number;
  studentId: number;
  studentNombre: string;
  studentApellido: string;
  studentGrado: string;
  studentSeccion: string;
  resourceId: number | null;
  resource: TaskResourceEmbed | null;
  titulo: string;
  curso: string;
  fechaEntrega: string;
  estado: TaskEstado;
  prioridad: 'alta' | 'media' | 'baja';
  comentarioEntrega: string;
  archivoEntregaUrl: string | null;
  archivoEntregaNombre: string | null;
  archivoEntregaMime: string | null;
  fechaEntregaReal: string | null;
  nota: number | null;
  retroalimentacion: string;
  calificadoAt: string | null;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(TeacherResource)
    private readonly resourcesRepository: Repository<TeacherResource>,
    private readonly docentesService: DocentesMaestrosService,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<TaskResponse> {
    const saved = await this.tasksRepository.save(
      this.tasksRepository.create(createTaskDto),
    );
    await this.applyOverdueStatus([saved]);
    return this.toResponse(saved);
  }

  async findAll(query?: {
    studentId?: number;
    resourceId?: number;
    titulo?: string;
    curso?: string;
    nivel?: string;
    grado?: string;
    seccion?: string;
  }): Promise<TaskResponse[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('t')
      .orderBy('t.fechaEntrega', 'ASC')
      .addOrderBy('t.id', 'ASC');

    if (query?.studentId !== undefined) {
      qb.andWhere('t.studentId = :studentId', { studentId: query.studentId });
    }
    if (query?.resourceId !== undefined) {
      qb.andWhere('t.resourceId = :resourceId', { resourceId: query.resourceId });
    }
    if (query?.titulo) {
      qb.andWhere('t.titulo = :titulo', { titulo: query.titulo });
    }
    if (query?.curso) {
      qb.andWhere('t.curso = :curso', { curso: query.curso });
    }

    let tasks = await qb.getMany();
    await this.applyOverdueStatus(tasks);

    if (query?.nivel || query?.grado || query?.seccion) {
      const allStudentMap = await this.loadStudentMap(tasks.map((t) => t.studentId));
      const gradoNorm = query.grado
        ? normalizeGradoMatricula(query.grado)
        : null;
      const seccionNorm = query.seccion
        ? query.seccion.trim().toUpperCase()
        : null;
      tasks = tasks.filter((t) => {
        const student = allStudentMap.get(t.studentId);
        if (!student) return false;
        if (query.nivel && student.nivel.trim() !== query.nivel.trim()) {
          return false;
        }
        if (gradoNorm && normalizeGradoMatricula(student.grado) !== gradoNorm) {
          return false;
        }
        if (
          seccionNorm &&
          student.seccion.trim().toUpperCase() !== seccionNorm
        ) {
          return false;
        }
        return true;
      });
    }

    const studentMap = await this.loadStudentMap(tasks.map((t) => t.studentId));
    const resourceByTaskId = await this.resolveResourcesForTasks(tasks, studentMap);
    return tasks.map((t) =>
      this.toResponseSync(
        t,
        studentMap.get(t.studentId),
        resourceByTaskId.get(t.id),
      ),
    );
  }

  /** Entregas SUBMITTED y vencidas sin entrega de los salones del docente (una sola llamada HTTP). */
  async findPendingReviewForUser(
    userId: number,
    username: string | undefined,
    anioEscolar?: number,
  ): Promise<PendingReviewResponse> {
    const { salones } = await this.docentesService.findSalonesForUser(
      userId,
      username,
      anioEscolar,
    );
    if (!salones.length) {
      return { porCalificar: [], vencidasSinEntrega: [] };
    }

    const resources = await this.loadTaskResourcesForSalons(salones);
    if (!resources.length) {
      return { porCalificar: [], vencidasSinEntrega: [] };
    }

    const today = new Date().toISOString().slice(0, 10);
    const porCalificar: PendingReviewTaskResponse[] = [];
    const vencidasSinEntrega: PendingReviewTaskResponse[] = [];

    const entregasPorRecurso = await Promise.all(
      resources.map(async (resource) => {
        const salon = this.matchSalonForResource(resource, salones);
        if (!salon) return [];
        const entregas = await this.findEntregasForResource({
          resourceId: resource.id,
          nivel: salon.nivel,
          grado: salon.grado,
          seccion: salon.seccion,
        });
        const salonLabel = `${salon.grado} "${salon.seccion}" · ${salon.nivel}`;
        const tareaTitulo = resource.descripcion?.trim() || resource.titulo;
        return entregas.map((e) => ({ ...e, tareaTitulo, salonLabel }));
      }),
    );

    for (const items of entregasPorRecurso) {
      for (const item of items) {
        if (item.estado === 'SUBMITTED') {
          porCalificar.push(item);
        } else if (
          (item.estado === 'OVERDUE' || item.estado === 'PENDING') &&
          item.fechaEntrega < today
        ) {
          vencidasSinEntrega.push(item);
        }
      }
    }

    porCalificar.sort((a, b) =>
      (b.fechaEntregaReal ?? b.fechaEntrega).localeCompare(
        a.fechaEntregaReal ?? a.fechaEntrega,
      ),
    );
    vencidasSinEntrega.sort((a, b) =>
      a.fechaEntrega.localeCompare(b.fechaEntrega),
    );

    return { porCalificar, vencidasSinEntrega };
  }

  async findEntregasForResource(query: {
    resourceId: number;
    nivel?: string;
    grado?: string;
    seccion?: string;
  }): Promise<TaskResponse[]> {
    const resource = await this.resourcesRepository.findOneBy({
      id: query.resourceId,
    });
    if (!resource) {
      throw new NotFoundException(`Recurso ${query.resourceId} no encontrado`);
    }

    const nivel = (query.nivel ?? resource.nivel).trim();
    const gradoNorm = normalizeGradoMatricula(query.grado ?? resource.grado);
    const seccionNorm = (query.seccion ?? resource.seccion).trim().toUpperCase();

    const salonStudents = await this.findStudentsInSalon(
      nivel,
      gradoNorm,
      seccionNorm,
    );

    const tasks = await this.tasksRepository.find({
      where: { resourceId: query.resourceId },
    });
    await this.applyOverdueStatus(tasks);

    const taskByStudent = new Map(tasks.map((t) => [t.studentId, t]));

    const responses = salonStudents.map((student) => {
      const task = taskByStudent.get(student.id);
      if (task) {
        return this.toResponseSync(task, student, resource);
      }
      return this.buildEmptyEntregaResponse(student, resource);
    });

    return responses.sort((a, b) =>
      `${a.studentApellido} ${a.studentNombre}`.localeCompare(
        `${b.studentApellido} ${b.studentNombre}`,
        'es',
      ),
    );
  }

  /**
   * Genera filas en `tasks` para cada alumno matriculado (`students`) del salón
   * del recurso publicado en `teacher_resources`.
   */
  async syncTasksForResource(resourceId: number): Promise<number> {
    const resource = await this.resourcesRepository.findOneBy({ id: resourceId });
    if (!resource) {
      throw new NotFoundException(`Recurso ${resourceId} no encontrado`);
    }

    const needsTask =
      resource.visible &&
      (resource.tipo === 'tarea' || resource.tipo === 'evaluacion') &&
      resource.fechaEntrega;

    if (!needsTask) return 0;

    const gradoNorm = normalizeGradoMatricula(resource.grado);
    const seccionNorm = resource.seccion.trim().toUpperCase();
    const students = await this.findStudentsInSalon(
      resource.nivel.trim(),
      gradoNorm,
      seccionNorm,
    );

    let created = 0;
    for (const student of students) {
      let task = await this.tasksRepository.findOne({
        where: { studentId: student.id, resourceId: resource.id },
      });

      if (!task) {
        task = await this.tasksRepository.findOne({
          where: {
            studentId: student.id,
            titulo: resource.titulo,
            curso: resource.curso,
          },
        });
      }

      if (task) {
        if (!task.resourceId) {
          task.resourceId = resource.id;
          await this.tasksRepository.save(task);
        }
        continue;
      }

      await this.tasksRepository.save(
        this.tasksRepository.create({
          studentId: student.id,
          resourceId: resource.id,
          titulo: resource.titulo,
          curso: resource.curso,
          fechaEntrega: resource.fechaEntrega!,
          estado: 'PENDING',
          prioridad: resource.tipo === 'evaluacion' ? 'alta' : 'media',
        }),
      );
      created++;
    }

    return created;
  }

  async findOne(id: number): Promise<TaskResponse> {
    const task = await this.getOrFail(id);
    await this.applyOverdueStatus([task]);
    return this.toResponse(task);
  }

  async update(id: number, updateTaskDto: UpdateTaskDto): Promise<TaskResponse> {
    const current = await this.getOrFail(id);
    const merged = this.tasksRepository.merge(current, updateTaskDto);
    const saved = await this.tasksRepository.save(merged);
    await this.applyOverdueStatus([saved]);
    return this.toResponse(saved);
  }

  async submit(
    id: number,
    file: Express.Multer.File,
    comentario?: string,
  ): Promise<TaskResponse> {
    const task = await this.getOrFail(id);
    if (task.estado === 'GRADED') {
      throw new BadRequestException('La tarea ya fue calificada y no admite cambios');
    }

    const savedFile = saveTaskSubmissionFile(file, task.studentId, task.id);
    task.comentarioEntrega = comentario?.trim() ?? '';
    task.archivoEntregaUrl = savedFile.url;
    task.archivoEntregaNombre = savedFile.nombreArchivo;
    task.archivoEntregaMime = savedFile.mimeType;
    task.fechaEntregaReal = new Date().toISOString().slice(0, 10);
    task.estado = 'SUBMITTED';

    const saved = await this.tasksRepository.save(task);
    return this.toResponse(saved);
  }

  async grade(id: number, dto: GradeTaskDto): Promise<TaskResponse> {
    const task = await this.getOrFail(id);
    if (task.estado !== 'SUBMITTED' && task.estado !== 'GRADED') {
      throw new BadRequestException('Solo se pueden calificar tareas entregadas');
    }

    if (dto.nota !== undefined) {
      task.nota = dto.nota;
    }
    if (dto.retroalimentacion !== undefined) {
      task.retroalimentacion = dto.retroalimentacion.trim();
    }
    if (task.nota !== null && task.nota !== undefined) {
      task.estado = 'GRADED';
      task.calificadoAt = new Date();
    }

    const saved = await this.tasksRepository.save(task);
    return this.toResponse(saved);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.tasksRepository.remove(current);
    return { deleted: true, id };
  }

  private async loadTaskResourcesForSalons(
    salones: DocenteSalonDetalle[],
  ): Promise<TeacherResource[]> {
    const qb = this.resourcesRepository
      .createQueryBuilder('r')
      .where('r.visible = true')
      .andWhere('r.tipo IN (:...tipos)', { tipos: ['tarea', 'evaluacion'] });

    qb.andWhere(
      new Brackets((orQb) => {
        salones.forEach((salon, index) => {
          orQb.orWhere(
            `(r.nivel = :nivel${index} AND r.grado = :grado${index} AND UPPER(TRIM(r.seccion)) = :seccion${index})`,
            {
              [`nivel${index}`]: salon.nivel.trim(),
              [`grado${index}`]: salon.grado.trim(),
              [`seccion${index}`]: salon.seccion.trim().toUpperCase(),
            },
          );
        });
      }),
    );

    return qb
      .orderBy('r.fechaEntrega', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getMany();
  }

  private matchSalonForResource(
    resource: TeacherResource,
    salones: DocenteSalonDetalle[],
  ): DocenteSalonDetalle | undefined {
    const gradoNorm = normalizeGradoMatricula(resource.grado);
    const seccionNorm = resource.seccion.trim().toUpperCase();
    const nivel = resource.nivel.trim();
    return salones.find(
      (s) =>
        s.nivel.trim() === nivel &&
        normalizeGradoMatricula(s.grado) === gradoNorm &&
        s.seccion.trim().toUpperCase() === seccionNorm,
    );
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

  private async findStudentsInSalon(
    nivel: string,
    gradoNorm: string,
    seccionNorm: string,
  ): Promise<Student[]> {
    const candidates = await this.studentsRepository.find({
      where: { activo: true, nivel },
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    return candidates.filter(
      (s) =>
        normalizeGradoMatricula(s.grado) === gradoNorm &&
        s.seccion.trim().toUpperCase() === seccionNorm,
    );
  }

  private async loadStudentMap(
    studentIds: number[],
  ): Promise<Map<number, Student>> {
    const uniqueIds = [...new Set(studentIds)];
    if (!uniqueIds.length) return new Map();
    const students = await this.studentsRepository.find({
      where: { id: In(uniqueIds) },
    });
    return new Map(students.map((s) => [s.id, s]));
  }

  private buildEmptyEntregaResponse(
    student: Student,
    resource: TeacherResource,
  ): TaskResponse {
    return {
      id: 0,
      studentId: student.id,
      studentNombre: student.nombre,
      studentApellido: student.apellido,
      studentGrado: student.grado,
      studentSeccion: student.seccion,
      resourceId: resource.id,
      resource: this.resourceToEmbed(resource),
      titulo: resource.titulo,
      curso: resource.curso,
      fechaEntrega: resource.fechaEntrega ?? '',
      estado: 'PENDING',
      prioridad: resource.tipo === 'evaluacion' ? 'alta' : 'media',
      comentarioEntrega: '',
      archivoEntregaUrl: null,
      archivoEntregaNombre: null,
      archivoEntregaMime: null,
      fechaEntregaReal: null,
      nota: null,
      retroalimentacion: '',
      calificadoAt: null,
    };
  }

  private async loadResourceMap(
    resourceIds: number[],
  ): Promise<Map<number, TeacherResource>> {
    const uniqueIds = [...new Set(resourceIds)];
    if (!uniqueIds.length) return new Map();
    const resources = await this.resourcesRepository.find({
      where: { id: In(uniqueIds) },
    });
    return new Map(resources.map((r) => [r.id, r]));
  }

  private async resolveResourcesForTasks(
    tasks: Task[],
    studentMap: Map<number, Student>,
  ): Promise<Map<number, TeacherResource>> {
    const preloaded = await this.loadResourceMap(
      tasks.map((t) => t.resourceId).filter((id): id is number => id != null),
    );
    const byTaskId = new Map<number, TeacherResource>();

    for (const task of tasks) {
      const student = studentMap.get(task.studentId);
      let resource = task.resourceId ? preloaded.get(task.resourceId) : undefined;

      if (!resource && student) {
        resource = await this.findResourceForTask(task, student);
        if (resource) {
          preloaded.set(resource.id, resource);
          if (!task.resourceId) {
            task.resourceId = resource.id;
            await this.tasksRepository.save(task);
          }
        }
      }

      if (resource) {
        byTaskId.set(task.id, resource);
      }
    }

    return byTaskId;
  }

  private async findResourceForTask(
    task: Task,
    student: Student,
  ): Promise<TeacherResource | undefined> {
    const gradoNorm = normalizeGradoMatricula(student.grado);
    const seccionNorm = student.seccion.trim().toUpperCase();
    const nivel = student.nivel.trim();

    const candidates = await this.resourcesRepository.find({
      where: { titulo: task.titulo, curso: task.curso, nivel },
      order: { fechaPublicacion: 'DESC', id: 'DESC' },
    });

    return candidates.find(
      (r) =>
        normalizeGradoMatricula(r.grado) === gradoNorm &&
        r.seccion.trim().toUpperCase() === seccionNorm,
    );
  }

  private resourceToEmbed(resource: TeacherResource): TaskResourceEmbed {
    return {
      id: resource.id,
      descripcion: resource.descripcion ?? '',
      tipo: resource.tipo,
      url: resource.url ?? '',
      nombreArchivo: resource.nombreArchivo ?? '',
      mimeType: resource.mimeType ?? '',
      tamanoBytes: resource.tamanoBytes ?? 0,
      docente: resource.docente ?? '',
    };
  }

  private toResponseSync(
    task: Task,
    student?: Student,
    resource?: TeacherResource,
  ): TaskResponse {
    return {
      id: task.id,
      studentId: task.studentId,
      studentNombre: student?.nombre ?? '',
      studentApellido: student?.apellido ?? '',
      studentGrado: student?.grado ?? '',
      studentSeccion: student?.seccion ?? '',
      resourceId: task.resourceId ?? null,
      resource: resource ? this.resourceToEmbed(resource) : null,
      titulo: task.titulo,
      curso: task.curso,
      fechaEntrega: task.fechaEntrega,
      estado: task.estado,
      prioridad: task.prioridad,
      comentarioEntrega: task.comentarioEntrega ?? '',
      archivoEntregaUrl: task.archivoEntregaUrl,
      archivoEntregaNombre: task.archivoEntregaNombre,
      archivoEntregaMime: task.archivoEntregaMime,
      fechaEntregaReal: task.fechaEntregaReal,
      nota:
        task.nota !== null && task.nota !== undefined
          ? Number(task.nota)
          : null,
      retroalimentacion: task.retroalimentacion ?? '',
      calificadoAt: task.calificadoAt ? task.calificadoAt.toISOString() : null,
    };
  }

  private async toResponse(task: Task): Promise<TaskResponse> {
    const student = await this.studentsRepository.findOneBy({
      id: task.studentId,
    });
    const resourceMap = await this.resolveResourcesForTasks(
      [task],
      student ? new Map([[task.studentId, student]]) : new Map(),
    );
    return this.toResponseSync(
      task,
      student ?? undefined,
      resourceMap.get(task.id),
    );
  }
}
