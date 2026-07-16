import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import {
  EventoEstado,
  SchoolEvent,
} from './entities/school-event.entity';

export interface EventResponse {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string | null;
  horaInicio: string;
  horaFin: string | null;
  lugar: string;
  destinatarios: string;
  nivel: string;
  responsable: string;
  publicado: boolean;
  cancelado: boolean;
  estado: EventoEstado;
  fechaInicioDisplay: string;
  fechaFinDisplay: string | null;
  horario: string;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(SchoolEvent)
    private readonly eventsRepo: Repository<SchoolEvent>,
  ) {}

  create(dto: CreateEventDto): Promise<EventResponse> {
    const entity = this.eventsRepo.create({
      titulo: dto.titulo.trim(),
      descripcion: dto.descripcion?.trim() ?? '',
      tipo: dto.tipo as SchoolEvent['tipo'],
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin ?? dto.fechaInicio,
      horaInicio: dto.horaInicio?.trim() || '08:00',
      horaFin: dto.horaFin?.trim() || null,
      lugar: dto.lugar?.trim() ?? '',
      destinatarios: dto.destinatarios as SchoolEvent['destinatarios'],
      nivel: dto.nivel?.trim() ?? '',
      responsable: dto.responsable?.trim() ?? '',
      publicado: dto.publicado ?? true,
    });
    return this.eventsRepo.save(entity).then((saved) => this.toResponse(saved));
  }

  async findAll(query?: {
    mes?: string;
    tipo?: string;
    destinatarios?: string;
    estado?: string;
    busqueda?: string;
  }): Promise<EventResponse[]> {
    const qb = this.eventsRepo
      .createQueryBuilder('e')
      .orderBy('e.fechaInicio', 'ASC')
      .addOrderBy('e.horaInicio', 'ASC');

    if (query?.mes) {
      qb.andWhere("TO_CHAR(e.fechaInicio, 'YYYY-MM') = :mes", { mes: query.mes });
    }
    if (query?.tipo) {
      qb.andWhere('e.tipo = :tipo', { tipo: query.tipo });
    }
    if (query?.destinatarios) {
      qb.andWhere('e.destinatarios = :destinatarios', {
        destinatarios: query.destinatarios,
      });
    }

    let rows = await qb.getMany();
    let result = rows.map((row) => this.toResponse(row));

    if (query?.estado) {
      result = result.filter((e) => e.estado === query.estado);
    }
    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.titulo.toLowerCase().includes(q) ||
          e.lugar.toLowerCase().includes(q) ||
          e.responsable.toLowerCase().includes(q),
      );
    }

    return result;
  }

  async findOne(id: number): Promise<EventResponse> {
    const event = await this.getOrFail(id);
    return this.toResponse(event);
  }

  async update(id: number, dto: UpdateEventDto): Promise<EventResponse> {
    const current = await this.getOrFail(id);
    Object.assign(current, {
      ...dto,
      titulo: dto.titulo !== undefined ? dto.titulo.trim() : current.titulo,
      descripcion:
        dto.descripcion !== undefined ? dto.descripcion.trim() : current.descripcion,
      lugar: dto.lugar !== undefined ? dto.lugar.trim() : current.lugar,
      responsable:
        dto.responsable !== undefined ? dto.responsable.trim() : current.responsable,
      nivel: dto.nivel !== undefined ? dto.nivel.trim() : current.nivel,
      horaInicio:
        dto.horaInicio !== undefined ? dto.horaInicio.trim() : current.horaInicio,
      horaFin: dto.horaFin !== undefined ? dto.horaFin?.trim() || null : current.horaFin,
    });
    const saved = await this.eventsRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.eventsRepo.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<SchoolEvent> {
    const event = await this.eventsRepo.findOneBy({ id });
    if (!event) throw new NotFoundException(`Evento ${id} no encontrado`);
    return event;
  }

  private toResponse(event: SchoolEvent): EventResponse {
    const fin = event.fechaFin ?? event.fechaInicio;
    return {
      id: event.id,
      titulo: event.titulo,
      descripcion: event.descripcion,
      tipo: event.tipo,
      fechaInicio: event.fechaInicio,
      fechaFin: event.fechaFin,
      horaInicio: event.horaInicio,
      horaFin: event.horaFin,
      lugar: event.lugar,
      destinatarios: event.destinatarios,
      nivel: event.nivel,
      responsable: event.responsable,
      publicado: event.publicado,
      cancelado: event.cancelado,
      estado: resolveEstado(event),
      fechaInicioDisplay: formatDate(event.fechaInicio),
      fechaFinDisplay: event.fechaFin ? formatDate(event.fechaFin) : null,
      horario: formatHorario(event.horaInicio, event.horaFin),
    };
  }
}

function resolveEstado(event: SchoolEvent): EventoEstado {
  if (event.cancelado) return 'cancelado';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = parseDate(event.fechaInicio);
  const fin = parseDate(event.fechaFin ?? event.fechaInicio);

  if (fin < today) return 'finalizado';
  if (inicio <= today && fin >= today) return 'en_curso';
  return 'programado';
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(value: string): string {
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function formatHorario(inicio: string, fin: string | null): string {
  return fin ? `${inicio} – ${fin}` : inicio;
}
