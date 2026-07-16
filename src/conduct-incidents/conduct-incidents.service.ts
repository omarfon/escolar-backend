import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import {
  CreateConductIncidentDto,
  UpdateConductIncidentDto,
} from './dto/conduct-incident.dto';
import { ConductIncident } from './entities/conduct-incident.entity';
import {
  buildConductKpis,
  buildConductResumen,
  ConductIncidentResponse,
  ConductIncidentsPage,
  normalizeFechaInput,
  toConductIncidentResponse,
} from './conduct-incidents.mapper';

export interface ConductIncidentFilters {
  studentId?: number;
  grado?: string;
  seccion?: string;
  tipo?: string;
  estado?: string;
  busqueda?: string;
  nivel?: string;
}

@Injectable()
export class ConductIncidentsService {
  constructor(
    @InjectRepository(ConductIncident)
    private readonly incidentRepo: Repository<ConductIncident>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  async create(dto: CreateConductIncidentDto): Promise<ConductIncidentResponse> {
    const student = await this.getStudentOrFail(dto.studentId);
    const entity = this.incidentRepo.create({
      studentId: dto.studentId,
      tipo: dto.tipo,
      descripcion: dto.descripcion.trim(),
      fecha: normalizeFechaInput(dto.fecha),
      lugar: dto.lugar?.trim() ?? '',
      reportadoPor: dto.reportadoPor?.trim() || 'Administrador',
      estado: dto.estado ?? 'pendiente',
      medida: dto.medida?.trim() ?? '',
      notificadoPadre: dto.notificadoPadre ?? false,
      observaciones: dto.observaciones?.trim() ?? '',
    });
    const saved = await this.incidentRepo.save(entity);
    return toConductIncidentResponse(saved, student);
  }

  async findAllPaginated(
    filters: ConductIncidentFilters = {},
    page = 1,
    pageSize = 10,
  ): Promise<ConductIncidentsPage> {
    const all = await this.buildFilteredList(filters);
    const kpis = buildConductKpis(all);
    let resumen = buildConductResumen(all);

    if (filters.nivel && filters.nivel !== 'todos') {
      resumen = resumen.filter((r) => r.nivel === filters.nivel);
    }

    const grados = [...new Set(all.map((i) => i.grado).filter(Boolean))].sort();
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const items = all.slice(start, start + pageSize);

    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages,
      kpis,
      resumen,
      grados,
    };
  }

  async findAll(
    filters: ConductIncidentFilters = {},
  ): Promise<ConductIncidentResponse[]> {
    return this.buildFilteredList(filters);
  }

  private async buildFilteredList(
    filters: ConductIncidentFilters,
  ): Promise<ConductIncidentResponse[]> {
    const qb = this.incidentRepo
      .createQueryBuilder('inc')
      .orderBy('inc.fecha', 'DESC')
      .addOrderBy('inc.id', 'DESC');

    if (filters.studentId !== undefined) {
      qb.andWhere('inc.studentId = :studentId', {
        studentId: filters.studentId,
      });
    }
    if (filters.tipo && filters.tipo !== 'todos') {
      qb.andWhere('inc.tipo = :tipo', { tipo: filters.tipo });
    }
    if (filters.estado && filters.estado !== 'todos') {
      qb.andWhere('inc.estado = :estado', { estado: filters.estado });
    }

    const incidents = await qb.getMany();
    if (!incidents.length) return [];

    const studentIds = [...new Set(incidents.map((i) => i.studentId))];
    const students = await this.studentRepo.find({
      where: { id: In(studentIds) },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    let result = incidents.map((inc) =>
      toConductIncidentResponse(inc, studentMap.get(inc.studentId)),
    );

    if (filters.grado && filters.grado !== 'todos') {
      result = result.filter((r) => r.grado === filters.grado);
    }
    if (filters.seccion && filters.seccion !== 'todos') {
      result = result.filter((r) => r.seccion === filters.seccion);
    }
    if (filters.busqueda?.trim()) {
      const q = filters.busqueda.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.alumno.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q) ||
          r.lugar.toLowerCase().includes(q),
      );
    }

    return result;
  }

  async findOne(id: number): Promise<ConductIncidentResponse> {
    const incident = await this.getOrFail(id);
    const student = await this.studentRepo.findOneBy({ id: incident.studentId });
    return toConductIncidentResponse(incident, student);
  }

  async update(
    id: number,
    dto: UpdateConductIncidentDto,
  ): Promise<ConductIncidentResponse> {
    const current = await this.getOrFail(id);
    let student = await this.studentRepo.findOneBy({ id: current.studentId });

    if (dto.studentId !== undefined && dto.studentId !== current.studentId) {
      student = await this.getStudentOrFail(dto.studentId);
      current.studentId = dto.studentId;
    }

    if (dto.tipo !== undefined) current.tipo = dto.tipo;
    if (dto.descripcion !== undefined) {
      current.descripcion = dto.descripcion.trim();
    }
    if (dto.fecha !== undefined) {
      current.fecha = normalizeFechaInput(dto.fecha);
    }
    if (dto.lugar !== undefined) current.lugar = dto.lugar.trim();
    if (dto.reportadoPor !== undefined) {
      current.reportadoPor = dto.reportadoPor.trim();
    }
    if (dto.estado !== undefined) current.estado = dto.estado;
    if (dto.medida !== undefined) current.medida = dto.medida.trim();
    if (dto.notificadoPadre !== undefined) {
      current.notificadoPadre = dto.notificadoPadre;
    }
    if (dto.observaciones !== undefined) {
      current.observaciones = dto.observaciones.trim();
    }

    const saved = await this.incidentRepo.save(current);
    return toConductIncidentResponse(saved, student);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.incidentRepo.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<ConductIncident> {
    const incident = await this.incidentRepo.findOneBy({ id });
    if (!incident) {
      throw new NotFoundException(`Incidente de conducta ${id} no encontrado`);
    }
    return incident;
  }

  private async getStudentOrFail(id: number): Promise<Student> {
    const student = await this.studentRepo.findOneBy({ id });
    if (!student) {
      throw new BadRequestException(`Estudiante ${id} no encontrado`);
    }
    return student;
  }
}
