import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateEventDto, UpdateEventDto } from '../../events/dto/event.dto';
import {
  Evento,
  EventoEstado,
} from '../../events/entities/evento.entity';
import {
  inferEventVisibility,
  normalizeEventVisibility,
} from '../../events/event-visibility.util';
import {
  canceladoFromEstado,
  computeEstadoFromDates,
  normalizeEventEstado,
} from '../../events/event-estado.util';
import { MAESTRO_EVENTOS_SEED } from './eventos-seed.data';

export interface MaestroEventoResponse {
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
export class EventosMaestrosService {
  constructor(
    @InjectRepository(Evento)
    private readonly eventoRepo: Repository<Evento>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    if ((await this.eventoRepo.count()) > 0) return;
    await this.migrarDesdeSchoolEvents();
    if ((await this.eventoRepo.count()) > 0) return;
    await this.eventoRepo.save(
      MAESTRO_EVENTOS_SEED.map((e) => {
        const estado = computeEstadoFromDates(e.fechaInicio, e.fechaFin);
        return this.eventoRepo.create({ ...e, estado, cancelado: false });
      }),
    );
  }

  async findAll(query?: {
    mes?: string;
    tipo?: string;
    destinatarios?: string;
    estado?: string;
    busqueda?: string;
  }): Promise<MaestroEventoResponse[]> {
    if ((await this.eventoRepo.count()) === 0) {
      await this.seedCatalogIfEmpty();
    }

    await this.syncEstadosLegacy();

    const qb = this.eventoRepo
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

  async create(dto: CreateEventDto): Promise<MaestroEventoResponse> {
    const vis = normalizeEventVisibility(dto);
    const fechaFin = dto.fechaFin ?? dto.fechaInicio;
    const estado = normalizeEventEstado({
      estado: dto.estado,
      fechaInicio: dto.fechaInicio,
      fechaFin,
    });
    const saved = await this.eventoRepo.save(
      this.eventoRepo.create({
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
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: number, dto: UpdateEventDto): Promise<MaestroEventoResponse> {
    const current = await this.getOrFail(id);
    const vis =
      dto.visibilidad !== undefined ||
      dto.destinatarios !== undefined ||
      dto.nivel !== undefined ||
      dto.grado !== undefined ||
      dto.seccion !== undefined
        ? normalizeEventVisibility({
            visibilidad: dto.visibilidad ?? current.visibilidad,
            destinatarios: dto.destinatarios ?? current.destinatarios,
            nivel: dto.nivel ?? current.nivel,
            grado: dto.grado ?? current.grado,
            seccion: dto.seccion ?? current.seccion,
          })
        : null;

    Object.assign(current, {
      ...dto,
      titulo: dto.titulo !== undefined ? dto.titulo.trim() : current.titulo,
      descripcion:
        dto.descripcion !== undefined ? dto.descripcion.trim() : current.descripcion,
      lugar: dto.lugar !== undefined ? dto.lugar.trim() : current.lugar,
      responsable:
        dto.responsable !== undefined ? dto.responsable.trim() : current.responsable,
      horaInicio:
        dto.horaInicio !== undefined ? dto.horaInicio.trim() : current.horaInicio,
      horaFin: dto.horaFin !== undefined ? dto.horaFin?.trim() || null : current.horaFin,
      ...(vis
        ? {
            visibilidad: vis.visibilidad,
            destinatarios: vis.destinatarios,
            nivel: vis.nivel,
            grado: vis.grado,
            seccion: vis.seccion,
          }
        : {}),
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

    const saved = await this.eventoRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const current = await this.getOrFail(id);
    current.cancelado = true;
    current.estado = 'cancelado';
    current.publicado = false;
    await this.eventoRepo.save(current);
    return { deleted: true, id };
  }

  private async migrarDesdeSchoolEvents(): Promise<void> {
    const legacyExists = await this.dataSource.query<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'school_events'
      ) AS "exists"`,
    );
    if (!legacyExists[0]?.exists) return;

    const legacyRows: Array<Record<string, unknown>> = await this.dataSource.query(
      'SELECT * FROM school_events ORDER BY id ASC',
    );
    if (!legacyRows.length) return;

    await this.eventoRepo.save(
      legacyRows.map((row) =>
        this.eventoRepo.create({
          titulo: String(row.titulo ?? ''),
          descripcion: String(row.descripcion ?? ''),
          tipo: String(row.tipo ?? 'academico') as Evento['tipo'],
          fechaInicio: formatDateValue(row.fechaInicio),
          fechaFin: row.fechaFin ? formatDateValue(row.fechaFin) : null,
          horaInicio: String(row.horaInicio ?? '08:00'),
          horaFin: row.horaFin ? String(row.horaFin) : null,
          lugar: String(row.lugar ?? ''),
          destinatarios: String(row.destinatarios ?? 'todos') as Evento['destinatarios'],
          nivel: String(row.nivel ?? ''),
          responsable: String(row.responsable ?? ''),
          publicado: Boolean(row.publicado ?? true),
          cancelado: Boolean(row.cancelado ?? false),
        }),
      ),
    );
  }

  private async getOrFail(id: number): Promise<Evento> {
    const evento = await this.eventoRepo.findOneBy({ id });
    if (!evento) throw new NotFoundException(`Evento ${id} no encontrado`);
    return evento;
  }

  private toResponse(event: Evento): MaestroEventoResponse {
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
    const rows = await this.eventoRepo.find();
    const pending = rows.filter((row) => {
      const expected = row.cancelado
        ? 'cancelado'
        : computeEstadoFromDates(row.fechaInicio, row.fechaFin);
      return !row.estado || (row.estado === 'programado' && expected !== 'programado');
    });
    if (!pending.length) return;

    await this.eventoRepo.save(
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

function formatDateValue(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value ?? '').slice(0, 10);
}
