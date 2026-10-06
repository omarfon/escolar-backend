import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../../audit-logs/audit-context.util';
import { AuditLoggerService } from '../../audit-logs/audit-logger.service';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { resolveTenantScopeFromRequest } from '../../auth/tenant-scope.util';
import { Evento } from '../../events/entities/evento.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { resolveInstitutionOrFail } from '../../institution/institution-scope.util';
import {
  PERMISO_CALENDARIZACION_GESTIONAR,
  PERMISO_CALENDARIZACION_VER,
} from '../anios-escolares/anio-escolar.constants';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';
import { FeriadosMaestrosService } from '../feriados/feriados.service';
import { EventosMaestrosService } from '../eventos/eventos.service';
import { PeriodosAcademicosMaestrosService } from '../periodos-academicos/periodos-academicos.service';
import {
  assertRangoDentroAnioEscolar,
  esFinDeSemana,
  eventoEnRango,
  fechaEnRango,
  resolveCalendarioRango,
} from './calendario-date.util';
import { CalendarioQueryDto } from './dto/calendario.dto';
import { resolveCalendarioAudiencia } from './calendario-audiencia.util';
import {
  CalendarioRolVista,
  esRolPortalCalendario,
  etiquetaRolVista,
  eventoVisibleParaRol,
  puedeGestionarCalendario,
  resolveCalendarioRolVista,
} from './calendario-role-filter.util';

export interface CalendarioContextResponse {
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    anioEscolarActivo: number;
    ugel: string;
    dre: string;
  };
  rolVista: CalendarioRolVista;
  rolVistaLabel: string;
  ambitos: string[];
  permisoVer: string;
  permisoGestionar: string;
  puedeGestionar: boolean;
  anioVigente: {
    id: number;
    anio: number;
    fechaInicio: string;
    fechaFin: string;
    tipoPeriodo: string;
    estado: string;
    publicado: boolean;
    version: number;
  } | null;
  aniosDisponibles: Array<{ anio: number; estado: string; vigente: boolean }>;
}

export interface CalendarioDiaItem {
  fecha: string;
  tipo: 'lectivo' | 'no_lectivo' | 'feriado' | 'fin_semana';
  feriado?: { id: number; nombre: string; tipo: string };
  eventos: Array<{
    id: number;
    titulo: string;
    tipo: string;
    horario: string;
    destinatarios: string;
  }>;
  periodo?: { id: number; nombre: string; numero: number };
}

export interface CalendarioVisualizacionResponse {
  contexto: {
    institucion: {
      id: number;
      nombre: string;
      siglas: string;
      anioEscolarActivo: number;
    };
    anioEscolar: number;
    mes: string;
    desde: string;
    hasta: string;
    rolVista: CalendarioRolVista;
    rolVistaLabel: string;
    puedeGestionar: boolean;
    anioEscolarPublicado: boolean;
    versionCalendario: number | null;
  };
  periodos: Array<{
    id: number;
    numero: number;
    nombre: string;
    tipo: string;
    inicio: string;
    fin: string;
    actual: boolean;
    estado: string;
  }>;
  feriados: Array<{
    id: number;
    fecha: string;
    nombre: string;
    tipo: string;
  }>;
  eventos: Array<{
    id: number;
    titulo: string;
    tipo: string;
    fechaInicio: string;
    fechaFin: string | null;
    horario: string;
    destinatarios: string;
    estado: string;
  }>;
  dias: CalendarioDiaItem[];
  resumen: {
    diasLaborables: number;
    feriados: number;
    eventos: number;
    periodos: number;
    diasLectivos: number;
  };
}

@Injectable()
export class CalendarioEscolarService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(MaestroAnioEscolar)
    private readonly anioRepo: Repository<MaestroAnioEscolar>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly feriadosService: FeriadosMaestrosService,
    private readonly eventosService: EventosMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getContext(req: Request & { user?: RequestUser }): Promise<CalendarioContextResponse> {
    const user = this.requireUser(req);
    const scope = resolveTenantScopeFromRequest(req, { mode: 'optional' });
    const institution = await this.requireInstitution(scope.institutionId);

    const rolVista = resolveCalendarioRolVista(user);
    const vigente = await this.anioRepo.findOne({
      where: { institutionId: institution.id, vigente: true, activo: true },
    });

    const anios = await this.anioRepo.find({
      where: { institutionId: institution.id, activo: true },
      order: { anio: 'DESC' },
      take: 20,
    });

    return {
      institucion: {
        id: institution.id,
        nombre: institution.nombre,
        siglas: institution.siglas,
        anioEscolarActivo: Number(institution.anio) || new Date().getFullYear(),
        ugel: institution.ugel ?? '',
        dre: institution.dre ?? '',
      },
      rolVista,
      rolVistaLabel: etiquetaRolVista(rolVista),
      ambitos: user.ambitos ?? [],
      permisoVer: PERMISO_CALENDARIZACION_VER,
      permisoGestionar: PERMISO_CALENDARIZACION_GESTIONAR,
      puedeGestionar: puedeGestionarCalendario(user),
      anioVigente: vigente
        ? {
            id: vigente.id,
            anio: vigente.anio,
            fechaInicio: vigente.fechaInicio,
            fechaFin: vigente.fechaFin,
            tipoPeriodo: vigente.tipoPeriodo,
            estado: vigente.estado,
            publicado: vigente.publicado,
            version: vigente.version,
          }
        : null,
      aniosDisponibles: anios.map((a) => ({
        anio: a.anio,
        estado: a.estado,
        vigente: a.vigente,
      })),
    };
  }

  async getVisualizacion(
    req: Request & { user?: RequestUser },
    query: CalendarioQueryDto,
  ): Promise<CalendarioVisualizacionResponse> {
    const user = this.requireUser(req);
    const scope = resolveTenantScopeFromRequest(req, { mode: 'optional' });
    const institution = await this.requireInstitution(scope.institutionId);
    const rolVista = resolveCalendarioRolVista(user);
    const rango = resolveCalendarioRango(query);

    const vigenteRow = await this.anioRepo.findOne({
      where: { institutionId: institution.id, vigente: true, activo: true },
    });

    const anioDesdeMes = Number(rango.mes.slice(0, 4));
    const anioEscolar =
      query.anioEscolar ??
      (Number.isFinite(anioDesdeMes) ? anioDesdeMes : undefined) ??
      vigenteRow?.anio ??
      (Number(institution.anio) || new Date().getFullYear());

    const anioRow =
      vigenteRow?.anio === anioEscolar
        ? vigenteRow
        : await this.anioRepo.findOne({
            where: { institutionId: institution.id, anio: anioEscolar, activo: true },
          });

    if (anioRow) {
      assertRangoDentroAnioEscolar(
        rango.desde,
        rango.hasta,
        anioRow.fechaInicio,
        anioRow.fechaFin,
      );
      if (
        query.anioEscolar != null &&
        anioRow.estado === 'planificado' &&
        esRolPortalCalendario(rolVista)
      ) {
        throw new ForbiddenException(
          'El calendario escolar aún no está publicado para su rol.',
        );
      }
    }

    const audiencia = await resolveCalendarioAudiencia(
      this.studentRepo,
      this.userRepo,
      user,
      rolVista,
    );

    const [periodosRaw, feriadosRaw, eventosRaw] = await Promise.all([
      this.periodosService.findAll({ anioEscolar, activo: true }),
      this.feriadosService.findAll({
        anioEscolar,
        activo: true,
        desde: rango.desde,
        hasta: rango.hasta,
      }),
      this.eventosService.findAll({ mes: rango.mes, institutionId: institution.id }),
    ]);

    const eventosFiltrados = eventosRaw.filter((e) =>
      eventoVisibleParaRol(
        {
          publicado: e.publicado,
          cancelado: e.cancelado || e.estado === 'cancelado',
          destinatarios: e.destinatarios as Evento['destinatarios'],
          visibilidad: e.visibilidad as Evento['visibilidad'],
          nivel: e.nivel,
          grado: e.grado,
          seccion: e.seccion,
        },
        rolVista,
        audiencia,
      ),
    );

    const feriados = feriadosRaw.map((f) => ({
      id: f.id,
      fecha: f.fecha,
      nombre: f.nombre,
      tipo: f.tipo,
    }));

    const eventos = eventosFiltrados
      .filter((e) => eventoEnRango(e.fechaInicio, e.fechaFin, rango.desde, rango.hasta))
      .map((e) => ({
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo,
        fechaInicio: e.fechaInicio,
        fechaFin: e.fechaFin,
        horario: e.horario,
        destinatarios: e.destinatarios,
        estado: e.estado,
      }));

    const periodos = periodosRaw.map((p) => ({
      id: p.id,
      numero: p.numero,
      nombre: p.nombre,
      tipo: p.tipo,
      inicio: p.inicio,
      fin: p.fin,
      actual: p.actual,
      estado: p.estado,
    }));

    const feriadoPorFecha = new Map(feriados.map((f) => [f.fecha, f]));
    const dias = this.buildDias(rango, feriadoPorFecha, eventos, periodos);

    const diasClase = await this.feriadosService.calcularDiasClase(
      rango.desde,
      rango.hasta,
      anioEscolar,
    );

    const response: CalendarioVisualizacionResponse = {
      contexto: {
        institucion: {
          id: institution.id,
          nombre: institution.nombre,
          siglas: institution.siglas,
          anioEscolarActivo: Number(institution.anio) || new Date().getFullYear(),
        },
        anioEscolar,
        mes: rango.mes,
        desde: rango.desde,
        hasta: rango.hasta,
        rolVista,
        rolVistaLabel: etiquetaRolVista(rolVista),
        puedeGestionar: puedeGestionarCalendario(user),
        anioEscolarPublicado: anioRow?.publicado ?? false,
        versionCalendario: anioRow?.version ?? null,
      },
      periodos,
      feriados,
      eventos,
      dias,
      resumen: {
        diasLaborables: diasClase.diasLaborables,
        feriados: feriados.length,
        eventos: eventos.length,
        periodos: periodos.length,
        diasLectivos: diasClase.diasClase,
      },
    };

    this.auditConsulta(req, user, anioEscolar, rango.mes, rolVista, scope);

    return response;
  }

  private buildDias(
    rango: { desde: string; hasta: string },
    feriadoPorFecha: Map<string, { id: number; nombre: string; tipo: string }>,
    eventos: CalendarioVisualizacionResponse['eventos'],
    periodos: CalendarioVisualizacionResponse['periodos'],
  ): CalendarioDiaItem[] {
    const dias: CalendarioDiaItem[] = [];
    let cursor = rango.desde;

    while (cursor <= rango.hasta) {
      const feriado = feriadoPorFecha.get(cursor);
      const finSemana = esFinDeSemana(cursor);
      const eventosDia = eventos
        .filter((e) => eventoEnRango(e.fechaInicio, e.fechaFin, cursor, cursor))
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          tipo: e.tipo,
          horario: e.horario,
          destinatarios: e.destinatarios,
        }));

      const periodo = periodos.find(
        (p) => cursor >= p.inicio && cursor <= p.fin,
      );

      let tipo: CalendarioDiaItem['tipo'] = 'lectivo';
      if (feriado) tipo = 'feriado';
      else if (finSemana) tipo = 'fin_semana';
      else if (eventosDia.some((e) => e.tipo === 'feriado')) tipo = 'no_lectivo';

      dias.push({
        fecha: cursor,
        tipo,
        feriado: feriado
          ? { id: feriado.id, nombre: feriado.nombre, tipo: feriado.tipo }
          : undefined,
        eventos: eventosDia,
        periodo: periodo
          ? { id: periodo.id, nombre: periodo.nombre, numero: periodo.numero }
          : undefined,
      });

      cursor = this.addDays(cursor, 1);
    }

    return dias;
  }

  private addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }

  private requireInstitution(institutionId?: number): Promise<Institution> {
    return resolveInstitutionOrFail(this.institutionRepo, institutionId);
  }

  private requireUser(req: Request & { user?: RequestUser }): RequestUser {
    if (!req.user) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return req.user;
  }

  private auditConsulta(
    req: Request,
    user: RequestUser,
    anioEscolar: number,
    mes: string,
    rolVista: CalendarioRolVista,
    scope: { institutionId?: number },
  ): void {
    const actor = parseActorFromRequest(req);
    this.auditLogger.log({
      accion: 'consultar',
      modulo: 'calendarizacion',
      entidad: 'calendario',
      descripcion: `Consulta calendario escolar ${mes} (año ${anioEscolar})`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      entidadId: String(anioEscolar),
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
      detalle: {
        mes,
        anioEscolar,
        rolVista,
        ambitos: user.ambitos ?? [],
        institutionId: scope.institutionId ?? null,
      },
    });
  }
}
