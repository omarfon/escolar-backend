import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentsService } from '../students/students.service';
import {
  AssignWaitlistDto,
  CreateWaitlistDto,
  UpdateWaitlistDto,
} from './dto/waitlist.dto';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

export interface WaitlistResponse {
  id: number;
  estudiante: string;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
  nivel: string;
  grado: string;
  seccionDeseada: string;
  prioridad: string;
  estado: string;
  observacion: string;
  studentId: number | null;
  fechaSolicitud: string;
  notificadoAt: string | null;
  asignadoAt: string | null;
  vacantesDisponibles: number;
}

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    private readonly studentsService: StudentsService,
  ) {}

  async findAll(query?: {
    nivel?: string;
    grado?: string;
    estado?: string;
    prioridad?: string;
  }): Promise<WaitlistResponse[]> {
    const qb = this.waitlistRepo
      .createQueryBuilder('w')
      .orderBy('w.fechaSolicitud', 'ASC');

    if (query?.nivel) qb.andWhere('w.nivel = :nivel', { nivel: query.nivel });
    if (query?.grado) qb.andWhere('w.grado = :grado', { grado: query.grado });
    if (query?.estado) qb.andWhere('w.estado = :estado', { estado: query.estado });
    if (query?.prioridad) {
      qb.andWhere('w.prioridad = :prioridad', { prioridad: query.prioridad });
    }

    const rows = await qb.getMany();
    const prioridadOrder = { alta: 0, media: 1, baja: 2 };
    rows.sort(
      (a, b) =>
        (prioridadOrder[a.prioridad] ?? 9) - (prioridadOrder[b.prioridad] ?? 9) ||
        a.fechaSolicitud.getTime() - b.fechaSolicitud.getTime(),
    );
    return Promise.all(rows.map((row) => this.toResponse(row)));
  }

  async create(dto: CreateWaitlistDto): Promise<WaitlistResponse> {
    const activo = await this.waitlistRepo.findOne({
      where: {
        dni: dto.dni,
        nivel: dto.nivel,
        grado: dto.grado,
        estado: 'en_espera',
      },
    });
    if (activo) {
      throw new BadRequestException(
        'El estudiante ya tiene una solicitud activa en lista de espera para este grado',
      );
    }

    const saved = await this.waitlistRepo.save(
      this.waitlistRepo.create({
        ...dto,
        email: dto.email?.trim() ?? '',
        telefono: dto.telefono?.trim() ?? '',
        seccionDeseada: dto.seccionDeseada?.trim().toUpperCase() ?? '',
        prioridad: dto.prioridad ?? 'media',
        observacion: dto.observacion?.trim() ?? '',
        estado: 'en_espera',
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: number, dto: UpdateWaitlistDto): Promise<WaitlistResponse> {
    const current = await this.getOrFail(id);
    if (current.estado === 'asignado') {
      throw new BadRequestException('No se puede editar un registro ya asignado');
    }

    Object.assign(current, {
      ...dto,
      email: dto.email !== undefined ? dto.email.trim() : current.email,
      telefono: dto.telefono !== undefined ? dto.telefono.trim() : current.telefono,
      seccionDeseada:
        dto.seccionDeseada !== undefined
          ? dto.seccionDeseada.trim().toUpperCase()
          : current.seccionDeseada,
      observacion:
        dto.observacion !== undefined ? dto.observacion.trim() : current.observacion,
    });

    const saved = await this.waitlistRepo.save(current);
    return this.toResponse(saved);
  }

  async notify(id: number): Promise<WaitlistResponse> {
    const current = await this.getOrFail(id);
    if (current.estado === 'asignado') {
      throw new BadRequestException('El registro ya fue asignado');
    }
    current.estado = 'notificado';
    current.notificadoAt = new Date();
    const saved = await this.waitlistRepo.save(current);
    return this.toResponse(saved);
  }

  async assign(id: number, dto: AssignWaitlistDto) {
    const entry = await this.getOrFail(id);
    if (entry.estado === 'asignado') {
      throw new BadRequestException('El registro ya fue asignado');
    }

    const occupancy = await this.studentsService.getSectionOccupancy(
      entry.nivel,
      entry.grado,
    );

    let targetSection = dto.seccion?.trim().toUpperCase() ?? entry.seccionDeseada;
    if (targetSection) {
      const occ = occupancy.find((o) => o.seccion === targetSection);
      if (!occ || occ.disponibles <= 0) {
        throw new BadRequestException(`La seccion ${targetSection} no tiene vacantes`);
      }
    } else {
      const available = occupancy.find((o) => o.disponibles > 0);
      if (!available) {
        throw new BadRequestException('No hay vacantes disponibles para este grado');
      }
      targetSection = available.seccion;
    }

    const email =
      entry.email ||
      `${entry.dni.toLowerCase()}@lista-espera.escolar.pe`;

    const students = await this.studentsService.findAll();
    let student = students.find((s) => s.email === email);

    if (student) {
      student = await this.studentsService.update(student.id, {
        nombre: entry.nombres,
        apellido: entry.apellidos,
        email,
        nivel: entry.nivel,
        grado: entry.grado,
        seccion: targetSection,
        activo: true,
      });
    } else {
      student = await this.studentsService.create({
        nombre: entry.nombres,
        apellido: entry.apellidos,
        email,
        nivel: entry.nivel,
        grado: entry.grado,
        seccion: targetSection,
        activo: true,
      });
    }

    entry.estado = 'asignado';
    entry.asignadoAt = new Date();
    entry.studentId = student.id;
    entry.seccionDeseada = targetSection;
    const saved = await this.waitlistRepo.save(entry);

    return {
      entry: await this.toResponse(saved),
      student,
      seccionAsignada: targetSection,
    };
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.waitlistRepo.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<WaitlistEntry> {
    const entry = await this.waitlistRepo.findOneBy({ id });
    if (!entry) throw new NotFoundException(`Registro ${id} no encontrado`);
    return entry;
  }

  private async toResponse(entry: WaitlistEntry): Promise<WaitlistResponse> {
    const occupancy = await this.studentsService.getSectionOccupancy(
      entry.nivel,
      entry.grado,
    );
    const vacantesDisponibles = occupancy.reduce(
      (sum, item) => sum + item.disponibles,
      0,
    );

    return {
      id: entry.id,
      estudiante: `${entry.apellidos}, ${entry.nombres}`,
      nombres: entry.nombres,
      apellidos: entry.apellidos,
      dni: entry.dni,
      email: entry.email,
      telefono: entry.telefono,
      nivel: entry.nivel,
      grado: entry.grado,
      seccionDeseada: entry.seccionDeseada,
      prioridad: entry.prioridad,
      estado: entry.estado,
      observacion: entry.observacion,
      studentId: entry.studentId,
      fechaSolicitud: this.formatDate(entry.fechaSolicitud),
      notificadoAt: entry.notificadoAt ? this.formatDate(entry.notificadoAt) : null,
      asignadoAt: entry.asignadoAt ? this.formatDate(entry.asignadoAt) : null,
      vacantesDisponibles,
    };
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
}
