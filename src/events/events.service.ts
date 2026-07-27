import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import {
  Evento,
  EventoEstado,
} from './entities/evento.entity';
import {
  inferEventVisibility,
  normalizeEventVisibility,
} from './event-visibility.util';
import {
  canceladoFromEstado,
  computeEstadoFromDates,
  normalizeEventEstado,
} from './event-estado.util';

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
  visibilidad: string;
  nivel: string;
  grado: string;
  seccion: string;
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
    @InjectRepository(Evento)
    private readonly eventsRepo: Repository<Evento>,
  ) {}

  create(dto: CreateEventDto): Promise<EventResponse> {
    const vis = normalizeEventVisibility(dto);
    const fechaFin = dto.fechaFin ?? dto.fechaInicio;
    const estado = normalizeEventEstado({
      estado: dto.estado,
      fechaInicio: dto.fechaInicio,
      fechaFin,
    });
    const entity = this.eventsRepo.create({
      titulo: dto.titulo.trim(),
      descripcion: dto.descripcion?.trim() ?? '',
      tipo: dto.tipo as Evento['tipo'],
      fechaInicio: dto.fechaInicio,
      fechaFin,
      horaInicio: dto.horaInicio?.trim() || '08:00',
      horaFin: dto.horaFin?.trim() || null,
      lugar: dto.lugar?.trim() ?? '',
      destinatarios: vis.destinatarios,
      visibilidad: vis.visibilidad,
      nivel: vis.nivel,
      grado: vis.grado,
      seccion: vis.seccion,
      responsable: dto.responsable?.trim() ?? '',
      publicado: dto.publicado ?? true,
      estado,
      cancelado: canceladoFromEstado(estado),
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
    await this.syncEstadosLegacy();

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
    if (query?.estado) {
      qb.andWhere('e.estado = :estado', { estado: query.estado });
    }

    let rows = await qb.getMany();
    let result = rows.map((row) => this.toResponse(row));

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

    if (dto.estado !== undefined || dto.cancelado !== undefined) {
      const estado = normalizeEventEstado({
        estado: dto.estado ?? current.estado,
        cancelado: dto.cancelado ?? current.cancelado,
        fechaInicio: current.fechaInicio,
        fechaFin: current.fechaFin,
      });
      current.estado = estado;
      current.cancelado = canceladoFromEstado(estado);
      if (estado === 'cancelado') {
        current.publicado = false;
      }
    }

    const saved = await this.eventsRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number) {
    const current = await this.getOrFail(id);
    await this.eventsRepo.remove(current);
    return { deleted: true, id };
  }

  private async getOrFail(id: number): Promise<Evento> {
    const event = await this.eventsRepo.findOneBy({ id });
    if (!event) throw new NotFoundException(`Evento ${id} no encontrado`);
    return event;
  }

  private toResponse(event: Evento): EventResponse {
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
      visibilidad: inferEventVisibility(event),
      nivel: event.nivel,
      grado: event.grado ?? '',
      seccion: event.seccion ?? '',
      responsable: event.responsable,
      publicado: event.publicado,
      cancelado: event.cancelado,
      estado: event.estado ?? computeEstadoFromDates(
        event.fechaInicio,
        event.fechaFin,
        event.cancelado,
      ),
      fechaInicioDisplay: formatDate(event.fechaInicio),
      fechaFinDisplay: event.fechaFin ? formatDate(event.fechaFin) : null,
      horario: formatHorario(event.horaInicio, event.horaFin),
    };
  }

  private async syncEstadosLegacy(): Promise<void> {
    const rows = await this.eventsRepo.find();
    const pending = rows.filter((row) => {
      const expected = row.cancelado
        ? 'cancelado'
        : computeEstadoFromDates(row.fechaInicio, row.fechaFin);
      return !row.estado || (row.estado === 'programado' && expected !== 'programado');
    });
    if (!pending.length) return;

    await this.eventsRepo.save(
      pending.map((row) => ({
        ...row,
        estado: row.cancelado
          ? 'cancelado'
          : computeEstadoFromDates(row.fechaInicio, row.fechaFin),
      })),
    );
  }
}

function formatDate(value: string): string {
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function formatHorario(inicio: string, fin: string | null): string {
  return fin ? `${inicio} – ${fin}` : inicio;
}
