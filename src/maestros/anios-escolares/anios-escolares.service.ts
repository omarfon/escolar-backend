import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../../audit-logs/audit-context.util';
import { AuditLoggerService } from '../../audit-logs/audit-logger.service';
import { Institution } from '../../institution/entities/institution.entity';
import { resolveInstitutionOrFail } from '../../institution/institution-scope.util';
import { Evento } from '../../events/entities/evento.entity';
import { MaestroFeriado } from '../feriados/entities/maestro-feriado.entity';
import { MaestroPeriodoAcademico } from '../periodos-academicos/entities/maestro-periodo-academico.entity';
import { PeriodosAcademicosMaestrosService } from '../periodos-academicos/periodos-academicos.service';
import {
  type CopiarCalendarioResultado,
  type CopiarCalendarioResumen,
  anioDeFechaIso,
  construirMensajeCopiaCalendario,
  desplazarFechaIso,
  fechaEnRangoAnioEscolar,
  periodoSolapaExistentes,
} from './anio-escolar-calendario-copy.util';
import {
  ESTADO_ANIO_ESCOLAR_LABEL,
  PERMISO_CALENDARIZACION_GESTIONAR,
  PERMISO_CALENDARIZACION_VER,
  type EstadoAnioEscolar,
} from './anio-escolar.constants';
import {
  fechasDefectoAnioEscolar,
  periodosDentroDeAnioEscolar,
  plantillaPeriodosAnioEscolar,
  rangosSeSolapan,
} from './anio-escolar-periodos.util';
import { Announcement } from '../../announcements/entities/announcement.entity';
import { construirComunicadoCalendario } from './anio-escolar-comunicado.util';
import {
  ActivarAnioEscolarDto,
  CerrarAnioEscolarDto,
  CopiarCalendarioAnioEscolarDto,
  CreateAnioEscolarDto,
  DividirPeriodosPorAnioIdDto,
  PublicarComunicadoCalendarioDto,
} from './dto/anio-escolar.dto';
import { MaestroAnioEscolarEvent } from './entities/maestro-anio-escolar-event.entity';
import { MaestroAnioEscolar } from './entities/maestro-anio-escolar.entity';

export interface AnioEscolarActorContext {
  req: Request;
  permisos: string[];
  ambitos: string[];
  esAdmin: boolean;
  institutionId?: number | null;
}

@Injectable()
export class AniosEscolaresService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(MaestroAnioEscolar)
    private readonly anioRepo: Repository<MaestroAnioEscolar>,
    @InjectRepository(MaestroAnioEscolarEvent)
    private readonly eventRepo: Repository<MaestroAnioEscolarEvent>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(MaestroFeriado)
    private readonly feriadoRepo: Repository<MaestroFeriado>,
    @InjectRepository(MaestroPeriodoAcademico)
    private readonly periodoRepo: Repository<MaestroPeriodoAcademico>,
    @InjectRepository(Evento)
    private readonly eventoRepo: Repository<Evento>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(ctx?: AnioEscolarActorContext) {
    const institution = await this.requireInstitution(ctx?.institutionId);
    const vigente = await this.anioRepo.findOne({
      where: { institutionId: institution.id, vigente: true, activo: true },
    });
    return {
      institucion: {
        id: institution.id,
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolarActivo: Number(institution.anio) || new Date().getFullYear(),
        ugel: institution.ugel,
        dre: institution.dre,
        codigoModular: institution.codigoModular,
      },
      permisoVer: PERMISO_CALENDARIZACION_VER,
      permisoGestionar: PERMISO_CALENDARIZACION_GESTIONAR,
      anioVigente: vigente ? this.toDto(vigente) : null,
      estados: Object.entries(ESTADO_ANIO_ESCOLAR_LABEL).map(([codigo, label]) => ({
        codigo,
        label,
      })),
      tiposPeriodo: ['bimestre', 'trimestre', 'semestre'],
    };
  }

  async findAll(
    query: { page?: number; pageSize?: number; estado?: EstadoAnioEscolar },
    ctx?: AnioEscolarActorContext,
  ) {
    if (!ctx?.institutionId) {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
      return { items: [], total: 0, page, pageSize };
    }
    const institution = await this.requireInstitution(ctx.institutionId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const qb = this.anioRepo
      .createQueryBuilder('a')
      .where('a.activo = true')
      .andWhere('a.institutionId = :institutionId', { institutionId: institution.id })
      .orderBy('a.anio', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.estado) {
      qb.andWhere('a.estado = :estado', { estado: query.estado });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((i) => this.toDto(i)), total, page, pageSize };
  }

  async findOne(id: number, ctx?: AnioEscolarActorContext) {
    const row = await this.getOrFail(id);
    if (ctx) this.assertInstitucionAcceso(row, ctx);
    const eventos = await this.eventRepo.find({
      where: { anioEscolarId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return {
      ...this.toDto(row),
      eventos: eventos.map((e) => ({
        id: e.id,
        accion: e.accion,
        estadoAnterior: e.estadoAnterior,
        estadoNuevo: e.estadoNuevo,
        motivo: e.motivo,
        cambios: e.cambios,
        actorNombre: e.actorNombre,
        actorRol: e.actorRol,
        createdAt: e.createdAt,
      })),
    };
  }

  async create(dto: CreateAnioEscolarDto, ctx: AnioEscolarActorContext) {
    this.assertGestionar(ctx);
    const institution = await this.requireInstitution(ctx.institutionId);
    this.validarFechas(dto.fechaInicio, dto.fechaFin);
    this.validarAnioEnRango(dto.anio, dto.fechaInicio, dto.fechaFin);

    if (dto.idempotencyKey) {
      const previo = await this.anioRepo.findOne({
        where: { institutionId: institution.id, idempotencyKey: dto.idempotencyKey },
      });
      if (previo) {
        return { ...this.toDto(previo), recuperado: true };
      }
    }

    const duplicado = await this.anioRepo.findOne({
      where: { institutionId: institution.id, anio: dto.anio, activo: true },
    });
    if (duplicado) {
      throw new ConflictException(`Ya existe el año escolar ${dto.anio} registrado.`);
    }

    await this.assertSinSolapamiento(institution.id, dto.fechaInicio, dto.fechaFin);

    return this.dataSource.transaction(async (manager) => {
      const anios = manager.getRepository(MaestroAnioEscolar);
      const eventos = manager.getRepository(MaestroAnioEscolarEvent);
      const instRepo = manager.getRepository(Institution);

      let row = anios.create({
        institutionId: institution.id,
        anio: dto.anio,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        tipoPeriodo: dto.tipoPeriodo,
        estado: 'planificado',
        vigente: false,
        version: 1,
        publicado: false,
        motivo: dto.motivo?.trim() ?? '',
        idempotencyKey: dto.idempotencyKey ?? null,
        activo: true,
      });
      row = await anios.save(row);

      await this.appendEvent(eventos, row, ctx, 'registrar', null, row.estado, dto.motivo ?? '', {
        anio: row.anio,
        fechaInicio: row.fechaInicio,
        fechaFin: row.fechaFin,
        tipoPeriodo: row.tipoPeriodo,
      });

      if (dto.generarPeriodos !== false) {
        const periodos = plantillaPeriodosAnioEscolar(row.anio, row.tipoPeriodo);
        if (!periodosDentroDeAnioEscolar(periodos, row.fechaInicio, row.fechaFin)) {
          throw new BadRequestException(
            'La plantilla de periodos no cabe dentro del rango del año escolar.',
          );
        }
        await this.periodosService.syncFromInstitution({
          id: row.institutionId,
          anio: String(row.anio),
          periodos,
        });
      }

      if (dto.activar) {
        row = await this.activarEnTransaccion(anios, eventos, instRepo, row, ctx, {
          motivo: dto.motivo,
          generarPeriodos: false,
        });
      }

      this.audit(ctx, 'crear', row, 'Año escolar registrado', {
        anio: row.anio,
        activar: !!dto.activar,
      });

      return { ...this.toDto(row), recuperado: false };
    });
  }

  async activate(id: number, dto: ActivarAnioEscolarDto, ctx: AnioEscolarActorContext) {
    this.assertGestionar(ctx);
    return this.dataSource.transaction(async (manager) => {
      const anios = manager.getRepository(MaestroAnioEscolar);
      const eventos = manager.getRepository(MaestroAnioEscolarEvent);
      const instRepo = manager.getRepository(Institution);
      let row = await anios.findOneBy({ id, activo: true });
      if (!row) throw new NotFoundException('Año escolar no encontrado');
      if (row.estado === 'cerrado') {
        throw new BadRequestException('No puede activar un año escolar cerrado.');
      }
      row = await this.activarEnTransaccion(anios, eventos, instRepo, row, ctx, dto);
      this.audit(ctx, 'actualizar', row, 'Año escolar activado', { anio: row.anio });
      return this.toDto(row);
    });
  }

  async dividirPeriodos(
    id: number,
    dto: DividirPeriodosPorAnioIdDto,
    ctx: AnioEscolarActorContext,
  ) {
    this.assertGestionar(ctx);
    const row = await this.getOrFail(id);
    this.assertInstitucionAcceso(row, ctx);

    if (dto.idempotencyKey) {
      const previo = await this.buscarDivisionIdempotente(row.id, dto.idempotencyKey);
      if (previo) return previo;
    }

    const resultado = await this.periodosService.dividirPeriodos(
      {
        anioEscolar: row.anio,
        tipo: dto.tipo,
        motivo: dto.motivo,
        sobreescribir: dto.sobreescribir,
        idempotencyKey: dto.idempotencyKey,
      },
      { req: ctx.req },
    );

    await this.appendEvent(
      this.eventRepo,
      row,
      ctx,
      'dividir_periodos',
      row.estado,
      row.estado,
      dto.motivo?.trim() ?? `División en ${resultado.tipo}`,
      {
        anioEscolar: row.anio,
        tipo: resultado.tipo,
        creados: resultado.creados,
        actualizados: resultado.actualizados,
        version: resultado.version,
        idempotencyKey: dto.idempotencyKey ?? null,
        sobreescribir: !!dto.sobreescribir,
      },
    );

    this.audit(ctx, 'actualizar', row, 'Año escolar dividido en periodos', {
      tipo: resultado.tipo,
      creados: resultado.creados,
      actualizados: resultado.actualizados,
    });

    return resultado;
  }

  async copyCalendario(
    id: number,
    dto: CopiarCalendarioAnioEscolarDto,
    ctx: AnioEscolarActorContext,
  ): Promise<CopiarCalendarioResultado> {
    this.assertGestionar(ctx);
    const destino = await this.getOrFail(id);
    this.assertInstitucionAcceso(destino, ctx);

    if (destino.estado !== 'planificado') {
      throw new BadRequestException(
        'Solo puede copiar calendario sobre un año escolar en estado planificado.',
      );
    }

    const anioOrigen = dto.anioOrigen ?? destino.anio - 1;
    if (anioOrigen >= destino.anio) {
      throw new BadRequestException(
        'El año origen debe ser anterior al año destino de la calendarización.',
      );
    }

    const deltaAnios = destino.anio - anioOrigen;
    const copiarPeriodos = dto.copiarPeriodos !== false;
    const copiarFeriados = dto.copiarFeriados !== false;
    const copiarEventos = dto.copiarEventos !== false;

    if (!copiarPeriodos && !copiarFeriados && !copiarEventos) {
      throw new BadRequestException('Debe seleccionar al menos un tipo de elemento a copiar.');
    }

    if (dto.idempotencyKey) {
      const previo = await this.buscarCopiaIdempotente(destino.id, dto.idempotencyKey);
      if (previo) {
        return { ...previo, recuperado: true };
      }
    }

    const origenRegistrado = await this.anioRepo.findOne({
      where: { institutionId: destino.institutionId, anio: anioOrigen, activo: true },
    });

    const [periodosOrigen, feriadosOrigen, eventosOrigen] = await Promise.all([
      copiarPeriodos
        ? this.periodoRepo.find({
            where: { anioEscolar: anioOrigen, activo: true },
            order: { numero: 'ASC' },
          })
        : Promise.resolve([]),
      copiarFeriados
        ? this.feriadoRepo.find({
            where: { anioEscolar: anioOrigen, activo: true },
            order: { fecha: 'ASC' },
          })
        : Promise.resolve([]),
      copiarEventos
        ? this.eventoRepo
            .createQueryBuilder('e')
            .where('(e.institutionId IS NULL OR e.institutionId = :institutionId)', {
              institutionId: destino.institutionId,
            })
            .andWhere('e.fechaInicio >= :inicio', { inicio: `${anioOrigen}-01-01` })
            .andWhere('e.fechaInicio <= :fin', { fin: `${anioOrigen}-12-31` })
            .getMany()
        : Promise.resolve([]),
    ]);

    if (
      !origenRegistrado &&
      periodosOrigen.length === 0 &&
      feriadosOrigen.length === 0 &&
      eventosOrigen.length === 0
    ) {
      throw new NotFoundException(
        `No hay calendario del año ${anioOrigen} para copiar (periodos, feriados o eventos).`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const anios = manager.getRepository(MaestroAnioEscolar);
      const eventos = manager.getRepository(MaestroAnioEscolarEvent);
      const feriados = manager.getRepository(MaestroFeriado);
      const periodos = manager.getRepository(MaestroPeriodoAcademico);
      const eventosInst = manager.getRepository(Evento);

      const resumenPeriodos: CopiarCalendarioResumen = {
        copiados: 0,
        omitidos: 0,
        fueraDeRango: 0,
      };
      const resumenFeriados: CopiarCalendarioResumen = {
        copiados: 0,
        omitidos: 0,
        fueraDeRango: 0,
      };
      const resumenEventos: CopiarCalendarioResumen = {
        copiados: 0,
        omitidos: 0,
        fueraDeRango: 0,
      };

      const periodosDestinoExistentes = await periodos.find({
        where: { anioEscolar: destino.anio, activo: true },
      });
      const feriadosDestinoExistentes = await feriados.find({
        where: { anioEscolar: destino.anio, activo: true },
      });
      const eventosDestinoExistentes = await eventosInst
        .createQueryBuilder('e')
        .where('(e.institutionId IS NULL OR e.institutionId = :institutionId)', {
          institutionId: destino.institutionId,
        })
        .andWhere('e.fechaInicio >= :inicio', { inicio: `${destino.anio}-01-01` })
        .andWhere('e.fechaInicio <= :fin', { fin: `${destino.anio}-12-31` })
        .getMany();

      const numerosPeriodoDestino = new Set(periodosDestinoExistentes.map((p) => p.numero));
      const fechasFeriadoDestino = new Set(feriadosDestinoExistentes.map((f) => f.fecha));
      const clavesEventoDestino = new Set(
        eventosDestinoExistentes.map((e) => `${e.titulo}|${e.fechaInicio}`),
      );

      const periodosAcumulados = periodosDestinoExistentes.map((p) => ({
        numero: p.numero,
        inicio: p.inicio,
        fin: p.fin,
      }));

      if (copiarPeriodos) {
        for (const src of periodosOrigen) {
          if (numerosPeriodoDestino.has(src.numero)) {
            resumenPeriodos.omitidos += 1;
            continue;
          }
          const inicio = desplazarFechaIso(src.inicio, deltaAnios);
          const fin = desplazarFechaIso(src.fin, deltaAnios);
          if (!inicio || !fin) {
            resumenPeriodos.fueraDeRango += 1;
            continue;
          }
          if (
            !fechaEnRangoAnioEscolar(inicio, destino.fechaInicio, destino.fechaFin) ||
            !fechaEnRangoAnioEscolar(fin, destino.fechaInicio, destino.fechaFin) ||
            inicio > fin
          ) {
            resumenPeriodos.fueraDeRango += 1;
            continue;
          }
          const propuesto = { numero: src.numero, inicio, fin };
          if (periodoSolapaExistentes(propuesto, periodosAcumulados)) {
            resumenPeriodos.omitidos += 1;
            continue;
          }
          await periodos.save(
            periodos.create({
              anioEscolar: destino.anio,
              numero: src.numero,
              nombre: src.nombre,
              tipo: src.tipo,
              inicio,
              fin,
              actual: false,
              descripcion: src.descripcion,
              activo: true,
            }),
          );
          periodosAcumulados.push(propuesto);
          numerosPeriodoDestino.add(src.numero);
          resumenPeriodos.copiados += 1;
        }
      }

      if (copiarFeriados) {
        for (const src of feriadosOrigen) {
          const fecha = desplazarFechaIso(src.fecha, deltaAnios);
          if (!fecha) {
            resumenFeriados.fueraDeRango += 1;
            continue;
          }
          if (!fechaEnRangoAnioEscolar(fecha, destino.fechaInicio, destino.fechaFin)) {
            resumenFeriados.fueraDeRango += 1;
            continue;
          }
          if (fechasFeriadoDestino.has(fecha)) {
            resumenFeriados.omitidos += 1;
            continue;
          }
          await feriados.save(
            feriados.create({
              anioEscolar: destino.anio,
              fecha,
              nombre: src.nombre,
              tipo: src.tipo,
              descripcion: src.descripcion,
              activo: true,
            }),
          );
          fechasFeriadoDestino.add(fecha);
          resumenFeriados.copiados += 1;
        }
      }

      if (copiarEventos) {
        for (const src of eventosOrigen) {
          const fechaInicio = desplazarFechaIso(src.fechaInicio, deltaAnios);
          if (!fechaInicio) {
            resumenEventos.fueraDeRango += 1;
            continue;
          }
          if (!fechaEnRangoAnioEscolar(fechaInicio, destino.fechaInicio, destino.fechaFin)) {
            resumenEventos.fueraDeRango += 1;
            continue;
          }
          const clave = `${src.titulo}|${fechaInicio}`;
          if (clavesEventoDestino.has(clave)) {
            resumenEventos.omitidos += 1;
            continue;
          }
          let fechaFin: string | null = null;
          if (src.fechaFin) {
            const anioFinOrigen = anioDeFechaIso(src.fechaFin);
            const deltaFin =
              anioFinOrigen !== null ? destino.anio - anioFinOrigen : deltaAnios;
            fechaFin = desplazarFechaIso(src.fechaFin, deltaFin);
            if (fechaFin && fechaFin < fechaInicio) {
              resumenEventos.omitidos += 1;
              continue;
            }
            if (fechaFin && !fechaEnRangoAnioEscolar(fechaFin, destino.fechaInicio, destino.fechaFin)) {
              fechaFin = null;
            }
          }
          await eventosInst.save(
            eventosInst.create({
              institutionId: src.institutionId ?? destino.institutionId,
              titulo: src.titulo,
              descripcion: src.descripcion,
              tipo: src.tipo,
              fechaInicio,
              fechaFin,
              horaInicio: src.horaInicio,
              horaFin: src.horaFin,
              lugar: src.lugar,
              destinatarios: src.destinatarios,
              visibilidad: src.visibilidad,
              nivel: src.nivel,
              grado: src.grado,
              seccion: src.seccion,
              responsable: src.responsable,
              publicado: false,
              cancelado: false,
              estado: 'programado',
            }),
          );
          clavesEventoDestino.add(clave);
          resumenEventos.copiados += 1;
        }
      }

      const totalCopiados =
        resumenPeriodos.copiados + resumenFeriados.copiados + resumenEventos.copiados;
      if (totalCopiados === 0) {
        throw new ConflictException(
          `No se pudo copiar ningún elemento del ${anioOrigen}: todos están duplicados o fuera del rango del año destino.`,
        );
      }

      let row = await anios.findOneBy({ id: destino.id, activo: true });
      if (!row) throw new NotFoundException('Año escolar no encontrado');
      row.version += 1;
      row = await anios.save(row);

      const resultadoBase = {
        anioDestino: destino.anio,
        anioOrigen,
        deltaAnios,
        periodos: resumenPeriodos,
        feriados: resumenFeriados,
        eventos: resumenEventos,
        version: row.version,
      };
      const resultado: CopiarCalendarioResultado = {
        ...resultadoBase,
        mensaje: construirMensajeCopiaCalendario(resultadoBase),
      };

      await this.appendEvent(
        eventos,
        row,
        ctx,
        'copiar_calendario',
        'planificado',
        row.estado,
        dto.motivo?.trim() ?? `Copia desde año ${anioOrigen}`,
        {
          ...resultadoBase,
          idempotencyKey: dto.idempotencyKey ?? null,
          copiarPeriodos,
          copiarFeriados,
          copiarEventos,
        },
      );

      this.audit(ctx, 'actualizar', row, 'Calendario copiado desde año anterior', {
        anioOrigen,
        anioDestino: destino.anio,
        periodos: resumenPeriodos,
        feriados: resumenFeriados,
        eventos: resumenEventos,
      });

      return resultado;
    });
  }

  async publicarComunicado(
    id: number,
    dto: PublicarComunicadoCalendarioDto,
    ctx: AnioEscolarActorContext,
  ) {
    this.assertPublicarComunicado(ctx);
    const institution = await this.requireInstitution(ctx.institutionId);
    const row = await this.anioRepo.findOneBy({ id, activo: true });
    if (!row) throw new NotFoundException('Año escolar no encontrado');
    this.assertInstitucionAcceso(row, ctx);

    if (row.estado === 'cerrado') {
      throw new BadRequestException('No puede publicar el calendario de un año escolar cerrado.');
    }

    if (dto.idempotencyKey) {
      const previo = await this.buscarPublicacionIdempotente(row.id, dto.idempotencyKey);
      if (previo) {
        return { ...previo, recuperado: true };
      }
    }

    if (row.publicado && !dto.republicar) {
      throw new ConflictException(
        'El calendario ya fue publicado. Indique republicar=true para emitir un nuevo comunicado.',
      );
    }

    const periodos = await this.periodoRepo.find({
      where: { anioEscolar: row.anio, activo: true },
      order: { numero: 'ASC' },
    });
    if (!periodos.length) {
      throw new BadRequestException(
        'Registre periodos académicos antes de publicar el comunicado del calendario.',
      );
    }
    if (!periodosDentroDeAnioEscolar(periodos, row.fechaInicio, row.fechaFin)) {
      throw new BadRequestException(
        'Los periodos académicos deben estar dentro del rango del año escolar.',
      );
    }

    const feriados = await this.feriadoRepo.count({
      where: { anioEscolar: row.anio, activo: true },
    });
    const eventos = await this.eventoRepo
      .createQueryBuilder('e')
      .where('e.institutionId = :institutionId', { institutionId: row.institutionId })
      .andWhere('e.fechaInicio >= :inicio', { inicio: row.fechaInicio })
      .andWhere('e.fechaInicio <= :fin', { fin: row.fechaFin })
      .getCount();

    const borrador = construirComunicadoCalendario({
      institutionNombre: institution.nombre,
      anio: row.anio,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      tipoPeriodo: row.tipoPeriodo,
      version: row.version,
      periodos: periodos.map((p) => ({
        nombre: p.nombre,
        inicio: p.inicio,
        fin: p.fin,
      })),
      feriados,
      eventos,
    });

    const fechaPublicacion =
      dto.fechaPublicacion?.trim() || new Date().toISOString().slice(0, 10);

    return this.dataSource.transaction(async (manager) => {
      const anios = manager.getRepository(MaestroAnioEscolar);
      const eventosDom = manager.getRepository(MaestroAnioEscolarEvent);
      const announcements = manager.getRepository(Announcement);
      const eventosInst = manager.getRepository(Evento);

      const versionAnterior = row.version;
      const announcement = await announcements.save(
        announcements.create({
          institutionId: row.institutionId,
          titulo: dto.titulo?.trim() || borrador.titulo,
          cuerpo: dto.cuerpo?.trim() || borrador.cuerpo,
          tipo: 'academico',
          destinatarios: dto.destinatarios ?? 'todos',
          prioridad: dto.prioridad ?? 'media',
          fechaPublicacion,
          fechaVencimiento: dto.fechaVencimiento?.trim() || undefined,
          habilitado: true,
        }),
      );

      await eventosInst
        .createQueryBuilder()
        .update(Evento)
        .set({ publicado: true })
        .where('institutionId = :institutionId', { institutionId: row.institutionId })
        .andWhere('fechaInicio >= :inicio', { inicio: row.fechaInicio })
        .andWhere('fechaInicio <= :fin', { fin: row.fechaFin })
        .andWhere('publicado = false')
        .execute();

      row.publicado = true;
      row.version += 1;
      const saved = await anios.save(row);

      await this.appendEvent(
        eventosDom,
        saved,
        ctx,
        'publicar_comunicado',
        saved.estado,
        saved.estado,
        dto.motivo?.trim() ?? 'Publicación del calendario escolar',
        {
          idempotencyKey: dto.idempotencyKey ?? null,
          announcementId: announcement.id,
          versionAnterior,
          versionNueva: saved.version,
          destinatarios: announcement.destinatarios,
          feriados,
          eventos,
        },
      );

      this.audit(ctx, 'actualizar', saved, 'Comunicado de calendario publicado', {
        announcementId: announcement.id,
        version: saved.version,
        destinatarios: announcement.destinatarios,
      });

      return {
        anioEscolar: this.toDto(saved),
        comunicado: {
          id: announcement.id,
          titulo: announcement.titulo,
          destinatarios: announcement.destinatarios,
          prioridad: announcement.prioridad,
          fechaPublicacion: announcement.fechaPublicacion,
        },
        version: saved.version,
        mensaje: `Calendario ${saved.anio} publicado (v${saved.version}).`,
      };
    });
  }

  async close(id: number, dto: CerrarAnioEscolarDto, ctx: AnioEscolarActorContext) {
    this.assertGestionar(ctx);
    return this.dataSource.transaction(async (manager) => {
      const anios = manager.getRepository(MaestroAnioEscolar);
      const eventos = manager.getRepository(MaestroAnioEscolarEvent);
      const row = await anios.findOneBy({ id, activo: true });
      if (!row) throw new NotFoundException('Año escolar no encontrado');
      if (row.estado === 'cerrado') {
        throw new BadRequestException('El año escolar ya está cerrado.');
      }
      if (row.vigente) {
        throw new BadRequestException(
          'Debe activar otro año escolar antes de cerrar el vigente.',
        );
      }

      const anterior = row.estado;
      row.estado = 'cerrado';
      row.version += 1;
      const saved = await anios.save(row);

      await this.appendEvent(eventos, saved, ctx, 'cerrar', anterior, saved.estado, dto.motivo, {
        version: saved.version,
      });
      this.audit(ctx, 'actualizar', saved, 'Año escolar cerrado', { motivo: dto.motivo });
      return this.toDto(saved);
    });
  }

  async seedFromInstitution(): Promise<void> {
    const institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) return;

    const count = await this.anioRepo.count({ where: { institutionId: institution.id } });
    if (count > 0) return;

    const anio = Number(institution.anio) || new Date().getFullYear();
    const fechas = fechasDefectoAnioEscolar(anio);
    await this.anioRepo.save(
      this.anioRepo.create({
        institutionId: institution.id,
        anio,
        ...fechas,
        tipoPeriodo: (institution.tipoPeriodo as MaestroAnioEscolar['tipoPeriodo']) ?? 'bimestre',
        estado: 'activo',
        vigente: true,
        version: 1,
        publicado: true,
        motivo: 'Migración desde configuración institucional',
        activo: true,
      }),
    );
  }

  private async activarEnTransaccion(
    anios: Repository<MaestroAnioEscolar>,
    eventos: Repository<MaestroAnioEscolarEvent>,
    instRepo: Repository<Institution>,
    row: MaestroAnioEscolar,
    ctx: AnioEscolarActorContext,
    dto: ActivarAnioEscolarDto,
  ): Promise<MaestroAnioEscolar> {
    await anios
      .createQueryBuilder()
      .update(MaestroAnioEscolar)
      .set({ vigente: false })
      .where('institutionId = :institutionId', { institutionId: row.institutionId })
      .andWhere('id <> :id', { id: row.id })
      .execute();

    const anterior = row.estado;
    row.estado = 'activo';
    row.vigente = true;
    row.publicado = true;
    row.version += 1;
    const saved = await anios.save(row);

    let periodos = plantillaPeriodosAnioEscolar(saved.anio, saved.tipoPeriodo);
    if (dto.generarPeriodos === false) {
      const inst = await instRepo.findOneBy({ id: saved.institutionId });
      periodos = inst?.periodos?.length ? inst.periodos : periodos;
    }

    await this.syncInstitutionPeriodos(instRepo, saved.institutionId, saved, periodos);
    await this.periodosService.syncFromInstitution({
      id: saved.institutionId,
      anio: String(saved.anio),
      periodos,
    });

    await this.appendEvent(
      eventos,
      saved,
      ctx,
      'activar',
      anterior,
      saved.estado,
      dto.motivo?.trim() ?? '',
      { version: saved.version, anioInstitucion: saved.anio },
    );

    return saved;
  }

  private async syncInstitutionPeriodos(
    instRepo: Repository<Institution>,
    institutionId: number,
    row: MaestroAnioEscolar,
    periodos: Institution['periodos'],
  ): Promise<void> {
    const inst = await instRepo.findOneBy({ id: institutionId });
    if (!inst) return;
    inst.anio = String(row.anio);
    inst.tipoPeriodo = row.tipoPeriodo;
    inst.periodos = periodos;
    await instRepo.save(inst);
  }

  private async assertSinSolapamiento(
    institutionId: number,
    fechaInicio: string,
    fechaFin: string,
    excludeId?: number,
  ): Promise<void> {
    const rows = await this.anioRepo.find({
      where: { institutionId, activo: true },
    });
    for (const row of rows) {
      if (excludeId && row.id === excludeId) continue;
      if (rangosSeSolapan(row.fechaInicio, row.fechaFin, fechaInicio, fechaFin)) {
        throw new ConflictException(
          `El rango se solapa con el año escolar ${row.anio} (${row.fechaInicio} – ${row.fechaFin}).`,
        );
      }
    }
  }

  private validarFechas(inicio: string, fin: string): void {
    if (inicio > fin) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la de fin.');
    }
  }

  private validarAnioEnRango(anio: number, inicio: string, fin: string): void {
    const iniYear = Number(inicio.slice(0, 4));
    const finYear = Number(fin.slice(0, 4));
    if (anio < iniYear - 1 || anio > finYear) {
      throw new BadRequestException(
        'El año escolar debe ser coherente con el rango de fechas indicado.',
      );
    }
  }

  private async getOrFail(id: number): Promise<MaestroAnioEscolar> {
    const row = await this.anioRepo.findOneBy({ id, activo: true });
    if (!row) throw new NotFoundException('Año escolar no encontrado');
    return row;
  }

  private requireInstitution(institutionId?: number | null): Promise<Institution> {
    return resolveInstitutionOrFail(this.institutionRepo, institutionId);
  }

  private assertInstitucionAcceso(row: MaestroAnioEscolar, ctx: AnioEscolarActorContext): void {
    if (ctx.institutionId && row.institutionId !== ctx.institutionId) {
      throw new ForbiddenException('No puede gestionar la calendarización de otra institución.');
    }
  }

  private async buscarDivisionIdempotente(
    anioEscolarId: number,
    idempotencyKey: string,
  ) {
    const previo = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.anioEscolarId = :anioEscolarId', { anioEscolarId })
      .andWhere('e.accion = :accion', { accion: 'dividir_periodos' })
      .andWhere("e.cambios->>'idempotencyKey' = :key", { key: idempotencyKey })
      .orderBy('e.createdAt', 'DESC')
      .getOne();

    if (!previo?.cambios) return null;

    const c = previo.cambios as Record<string, unknown>;
    const anioEscolar = c.anioEscolar as number;
    if (!anioEscolar) return null;

    const periodos = await this.periodosService.findAll({ anioEscolar, activo: true });

    return {
      anioEscolar,
      tipo: (c.tipo as string) ?? 'bimestre',
      creados: (c.creados as number) ?? 0,
      actualizados: (c.actualizados as number) ?? 0,
      omitidos: periodos.length,
      version: (c.version as number) ?? undefined,
      recuperado: true,
      mensaje: `Operación idempotente recuperada para el año ${anioEscolar}.`,
      periodos,
    };
  }

  private async buscarCopiaIdempotente(
    anioEscolarId: number,
    idempotencyKey: string,
  ): Promise<CopiarCalendarioResultado | null> {
    const previo = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.anioEscolarId = :anioEscolarId', { anioEscolarId })
      .andWhere('e.accion = :accion', { accion: 'copiar_calendario' })
      .andWhere("e.cambios->>'idempotencyKey' = :key", { key: idempotencyKey })
      .orderBy('e.createdAt', 'DESC')
      .getOne();

    if (!previo?.cambios) return null;

    const c = previo.cambios as Record<string, unknown>;
    if (typeof c.anioDestino !== 'number' || typeof c.anioOrigen !== 'number') {
      return null;
    }

    const resultadoBase = {
      anioDestino: c.anioDestino as number,
      anioOrigen: c.anioOrigen as number,
      deltaAnios: (c.deltaAnios as number) ?? (c.anioDestino as number) - (c.anioOrigen as number),
      periodos: (c.periodos as CopiarCalendarioResumen) ?? { copiados: 0, omitidos: 0, fueraDeRango: 0 },
      feriados: (c.feriados as CopiarCalendarioResumen) ?? { copiados: 0, omitidos: 0, fueraDeRango: 0 },
      eventos: (c.eventos as CopiarCalendarioResumen) ?? { copiados: 0, omitidos: 0, fueraDeRango: 0 },
      version: (c.version as number) ?? 1,
    };

    return {
      ...resultadoBase,
      mensaje: construirMensajeCopiaCalendario(resultadoBase),
    };
  }

  private async buscarPublicacionIdempotente(
    anioEscolarId: number,
    idempotencyKey: string,
  ): Promise<{
    anioEscolar: ReturnType<AniosEscolaresService['toDto']>;
    comunicado: {
      id: number;
      titulo: string;
      destinatarios: string;
      prioridad: string;
      fechaPublicacion: string;
    };
    version: number;
    mensaje: string;
  } | null> {
    const ev = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.anioEscolarId = :anioEscolarId', { anioEscolarId })
      .andWhere('e.accion = :accion', { accion: 'publicar_comunicado' })
      .andWhere("e.cambios->>'idempotencyKey' = :key", { key: idempotencyKey })
      .orderBy('e.id', 'DESC')
      .getOne();

    if (!ev) return null;

    const row = await this.anioRepo.findOneBy({ id: anioEscolarId, activo: true });
    if (!row) return null;

    const announcementId = Number(ev.cambios?.['announcementId'] ?? 0);
    const announcement = announcementId
      ? await this.announcementRepo.findOneBy({ id: announcementId })
      : null;

    return {
      anioEscolar: this.toDto(row),
      comunicado: {
        id: announcement?.id ?? announcementId,
        titulo: announcement?.titulo ?? 'Comunicado de calendario',
        destinatarios: announcement?.destinatarios ?? 'todos',
        prioridad: announcement?.prioridad ?? 'media',
        fechaPublicacion:
          announcement?.fechaPublicacion ?? new Date().toISOString().slice(0, 10),
      },
      version: row.version,
      mensaje: `Calendario ${row.anio} publicado (v${row.version}).`,
    };
  }

  private assertPublicarComunicado(ctx: AnioEscolarActorContext): void {
    this.assertGestionar(ctx);
    if (
      ctx.esAdmin ||
      ctx.permisos.includes('comunicados.enviar') ||
      ctx.permisos.includes('admin.institucional')
    ) {
      return;
    }
    throw new ForbiddenException('No tiene permiso para publicar comunicados del calendario.');
  }

  private assertGestionar(ctx: AnioEscolarActorContext): void {
    if (
      ctx.esAdmin ||
      ctx.permisos.includes(PERMISO_CALENDARIZACION_GESTIONAR) ||
      ctx.permisos.includes('admin.institucional')
    ) {
      return;
    }
    throw new ForbiddenException('No tiene permiso para gestionar la calendarización escolar.');
  }

  private async appendEvent(
    repo: Repository<MaestroAnioEscolarEvent>,
    row: MaestroAnioEscolar,
    ctx: AnioEscolarActorContext,
    accion: string,
    estadoAnterior: string | null,
    estadoNuevo: string | null,
    motivo: string,
    cambios: Record<string, unknown>,
  ): Promise<void> {
    const actor = parseActorFromRequest(ctx.req);
    await repo.save(
      repo.create({
        anioEscolarId: row.id,
        accion,
        estadoAnterior,
        estadoNuevo,
        motivo: motivo.trim(),
        cambios,
        actorUserId: actor.usuarioId,
        actorNombre: actor.usuarioNombre,
        actorRol: actor.usuarioRol,
      }),
    );
  }

  private audit(
    ctx: AnioEscolarActorContext,
    accion: 'crear' | 'actualizar',
    row: MaestroAnioEscolar,
    descripcion: string,
    detalle: Record<string, unknown>,
  ): void {
    const actor = parseActorFromRequest(ctx.req);
    this.auditLogger.log({
      accion,
      modulo: 'calendarizacion',
      entidad: 'anio_escolar',
      entidadId: String(row.id),
      descripcion: `${descripcion} ${row.anio}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip: getClientIp(ctx.req),
      correlationId: getCorrelationId(ctx.req),
      resultado: 'success',
      detalle,
    });
  }

  toDto(row: MaestroAnioEscolar) {
    return {
      id: row.id,
      institutionId: row.institutionId,
      anio: row.anio,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      tipoPeriodo: row.tipoPeriodo,
      estado: row.estado,
      vigente: row.vigente,
      version: row.version,
      publicado: row.publicado,
      motivo: row.motivo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
