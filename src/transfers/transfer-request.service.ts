import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, EntityManager, In, Not, QueryFailedError, Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { AuditAccion, AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Student } from '../students/entities/student.entity';
import { StudentDocumentsService } from '../students/student-documents.service';
import type { EvidenciaTrasladoTipo } from './transfer-evidencia.constants';
import {
  assertEvidenciaListaParaEnviar,
  resolverEvidenciaTraslado,
  type EvidenciaTrasladoResuelta,
} from './transfer-evidencia.util';
import {
  CreateTransferRequestDto,
  RegisterTransferMotivoDto,
  TransitionTransferRequestDto,
  UpdateTransferRequestDto,
} from './dto/transfer-request.dto';
import { TransferNotification } from './entities/transfer-notification.entity';
import { TransferRequestEvent } from './entities/transfer-request-event.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import {
  ACCIONES_TRASLADO_MOTIVO_OBLIGATORIO,
  ACCION_REGISTRAR_MOTIVO,
  ACCION_TRASLADO_LABEL,
  AccionTraslado,
  ESTADOS_TRASLADO_ACTIVOS,
  ESTADOS_TRASLADO_TERMINALES,
  EstadoTraslado,
  PERMISO_TRASLADOS_APROBAR_DESTINO,
  PERMISO_TRASLADOS_RESOLVER,
  PERMISO_TRASLADOS_SOLICITAR,
  PERMISO_TRASLADOS_VER,
} from './transfer.constants';
import {
  codigoTraslado,
  hoyLima,
  iePuedeVerSolicitud,
  permisoDeAccion,
  siguienteEstado,
} from './transfer-state.util';
import { TransferNotificationService } from './transfer-notification.service';
import { TransferEnrollmentService } from './transfer-enrollment.service';
import {
  TransferVacancyService,
  type TransferVacancySnapshot,
} from './transfer-vacancy.service';
import {
  construirEtapasSeguimiento,
  construirLineaTiempo,
  construirResumenSeguimiento,
  rolVisualizadorSeguimiento,
} from './transfer-seguimiento.util';
import {
  aplicarFiltroTerritorialAlcance,
  requiereInstitucionReferencia,
  resolverAlcanceTerritorial,
  solicitudFueraDeAlcance,
  type ResolvedTransferTerritorialScope,
} from './transfer-territorial-scope.util';
import { buildTransferSnapshotTransparency } from './transfer-snapshot-transparency.util';

import type { TransferActorContext } from './transfer-actor.interface';
export type { TransferActorContext } from './transfer-actor.interface';

@Injectable()
export class TransferRequestService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(TransferRequest)
    private readonly requestRepo: Repository<TransferRequest>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly auditLogger: AuditLoggerService,
    private readonly notificationService: TransferNotificationService,
    private readonly studentDocuments: StudentDocumentsService,
    private readonly transferVacancy: TransferVacancyService,
    private readonly transferEnrollment: TransferEnrollmentService,
  ) {}

  async getVacanteDestino(id: number, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const row = await this.requestRepo.findOneBy({ id });
    if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
    this.assertEnAlcance(row, scope);
    const student = await this.studentRepo.findOneBy({ id: row.studentId });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const vacante = await this.transferVacancy.previewVacanteDestino(row, student);
    return {
      ...vacante,
      studentId: student.id,
      seccionOrigen: student.seccion,
      seccionDestinoAsignada: row.seccionDestino,
    };
  }

  async getContext(ctx?: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const institution = scope.institution;
    const anioEscolar = institution
      ? Number(institution.anio) || new Date().getFullYear()
      : new Date().getFullYear();
    return {
      institucion: institution
        ? {
            nombre: institution.nombre,
            siglas: institution.siglas,
            anioEscolar,
            ugel: institution.ugel ?? '',
            dre: institution.dre ?? '',
            codigoModular: institution.codigoModular ?? '',
          }
        : null,
      alcanceTerritorial: {
        nivel: scope.nivel,
        ugel: scope.ugel ?? institution?.ugel ?? '',
        dre: scope.dre ?? institution?.dre ?? '',
        fuente: scope.fuente,
        requiereInstitucionReferencia: requiereInstitucionReferencia(scope.nivel),
      },
      permisoVer: PERMISO_TRASLADOS_VER,
      permisoSolicitar: PERMISO_TRASLADOS_SOLICITAR,
      permisoResolver: PERMISO_TRASLADOS_RESOLVER,
      permisoAprobarDestino: PERMISO_TRASLADOS_APROBAR_DESTINO,
      estados: [
        'borrador',
        'enviada',
        'observada',
        'aprobada',
        'rechazada',
        'cancelada',
        'concluida',
      ],
    };
  }

  async findAll(
    ctx: TransferActorContext,
    query: {
      page?: number;
      pageSize?: number;
      estado?: string;
      q?: string;
      alcance?: string;
      pendientes?: boolean;
      activos?: boolean;
    },
  ) {
    const scope = await this.resolveScope(ctx);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const qb = this.requestRepo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');
    aplicarFiltroTerritorialAlcance(qb, scope);
    if (query.alcance === 'destino') {
      const modular = (scope.institution?.codigoModular ?? '').trim();
      if (modular) {
        qb.andWhere('t."ieDestinoCodigoModular" = :destMod', { destMod: modular });
        qb.andWhere('t."ieOrigenCodigoModular" <> :destMod');
        qb.andWhere("t.estado <> 'borrador'");
      }
    }
    if (query.pendientes) {
      qb.andWhere('t.estado IN (:...estadosPendientes)', {
        estadosPendientes: ['enviada', 'observada'],
      });
    }
    if (query.activos) {
      qb.andWhere('t.estado IN (:...estadosActivos)', {
        estadosActivos: ESTADOS_TRASLADO_ACTIVOS,
      });
    }
    if (query.estado?.trim()) {
      qb.andWhere('t.estado = :estado', { estado: query.estado.trim() });
    }
    const q = query.q?.trim();
    if (q) {
      qb.andWhere(
        `(t.codigo ILIKE :q OR t."studentNombre" ILIKE :q OR t."studentDni" ILIKE :q OR t."ieDestinoNombre" ILIKE :q)`,
        { q: `%${q}%` },
      );
    }
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: rows.map((row) => this.toSummary(row)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const row = await this.requestRepo.findOneBy({ id });
    if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
    this.assertEnAlcance(row, scope);
    const children = await this.loadChildren(this.dataSource.manager, id);
    const historialAcademico = await this.historialAcademico(row.studentId);
    const evidenciaDetalle = await this.buildEvidenciaDetalle(row);
    const transparencia = await this.buildTransparenciaSnapshot(row, children.eventos);
    return this.toDetail(row, children, false, historialAcademico, evidenciaDetalle, transparencia);
  }

  async getSeguimiento(id: number, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const row = await this.requestRepo.findOneBy({ id });
    if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
    this.assertEnAlcance(row, scope);

    const children = await this.loadChildren(this.dataSource.manager, id);
    const auditoria = await this.auditRepo.find({
      where: {
        modulo: 'traslados',
        entidad: 'solicitud_traslado',
        entidadId: String(id),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const eventosDto = children.eventos.map((e) => ({
      id: e.id,
      accion: e.accion,
      estadoAnterior: e.estadoAnterior,
      estadoNuevo: e.estadoNuevo,
      motivo: e.motivo,
      observacion: e.observacion,
      actorNombre: e.actorNombre,
      createdAt: e.createdAt,
    }));
    const notificacionesDto = children.notificaciones.map((n) => this.notificationService.toDto(n));
    const auditoriaDto = auditoria.map((a) => ({
      id: a.id,
      accion: a.accion,
      descripcion: a.descripcion,
      usuarioNombre: a.usuarioNombre,
      resultado: a.resultado,
      detalle: a.detalle,
      createdAt: a.createdAt,
    }));

    const lineaTiempo = construirLineaTiempo({
      eventos: eventosDto,
      notificaciones: notificacionesDto.map((n) => ({
        id: n.id,
        mensaje: n.mensaje,
        ambito: n.ambito,
        destinatario: n.destinatario,
        destinatarioUserId: n.destinatarioUserId,
        destinatarioEmail: n.destinatarioEmail,
        destinatarioRol: n.destinatarioRol,
        estadoEntrega: n.estadoEntrega,
        estadoAnterior: n.estadoAnterior,
        estadoNuevo: n.estadoNuevo,
        createdAt: n.createdAt,
      })),
      auditoria: auditoriaDto,
    });

    const esTerritorial =
      ctx.esAdmin ||
      (ctx.permisos.includes(PERMISO_TRASLADOS_RESOLVER) &&
        ctx.ambitos.some((a) => a === 'UGEL' || a === 'DRE' || a === 'MINEDU'));

    return {
      solicitud: {
        ...this.toSummary(row),
        motivo: row.motivo,
        observacion: row.observacion,
        evidencia: row.evidencia,
        evidenciaTipo: row.evidenciaTipo,
        evidenciaDocumentId: row.evidenciaDocumentId,
        evidenciaReferencia: row.evidenciaReferencia,
        updatedAt: row.updatedAt,
        ieOrigenUgel: row.ieOrigenUgel,
        ieOrigenDre: row.ieOrigenDre,
        ieDestinoUgel: row.ieDestinoUgel,
        ieDestinoDre: row.ieDestinoDre,
        actorNombre: row.actorNombre,
        actorRol: row.actorRol,
        rolVisualizador: rolVisualizadorSeguimiento(
          scope.institution?.codigoModular ?? '',
          row.ieOrigenCodigoModular,
          row.ieDestinoCodigoModular,
          esTerritorial &&
            row.ieOrigenCodigoModular !== (scope.institution?.codigoModular ?? '').trim() &&
            row.ieDestinoCodigoModular !== (scope.institution?.codigoModular ?? '').trim(),
        ),
      },
      etapas: construirEtapasSeguimiento(row.estado, eventosDto),
      lineaTiempo,
      resumen: construirResumenSeguimiento({
        estado: row.estado,
        createdAt: row.createdAt,
        plazoHasta: row.plazoHasta,
        lineaTiempo,
      }),
      eventos: eventosDto.map((e) => ({
        ...e,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      })),
      notificaciones: notificacionesDto,
      auditoria: auditoriaDto.map((a) => ({
        ...a,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      })),
      transparencia: await this.buildTransparenciaSnapshot(row, children.eventos),
    };
  }

  async searchStudents(q: string, ctx?: TransferActorContext) {
    const term = q.trim();
    if (term.length < 2) return [];
    if (!ctx) {
      throw new BadRequestException('Contexto de usuario no disponible.');
    }
    const institution = await this.requireInstitutionIe(ctx);
    const rows = await this.studentRepo
      .createQueryBuilder('s')
      .where('s.activo = true')
      .andWhere(`s.estadoMatricula = 'activo'`)
      .andWhere('s.institutionId = :institutionId', { institutionId: institution.id })
      .andWhere(
        `(s.dni ILIKE :q OR s.nombre ILIKE :q OR s.apellido ILIKE :q OR s.codigo ILIKE :q)`,
        { q: `%${term}%` },
      )
      .orderBy('s.apellido', 'ASC')
      .addOrderBy('s.nombre', 'ASC')
      .take(15)
      .getMany();
    return rows.map((s) => ({
      id: s.id,
      codigo: s.codigo,
      nombres: s.nombre,
      apellidos: s.apellido,
      dni: s.dni,
      nivel: s.nivel,
      grado: s.grado,
      seccion: s.seccion,
      estadoMatricula: s.estadoMatricula,
    }));
  }

  async searchInstitutions(q: string, ctx?: TransferActorContext) {
    const term = q.trim();
    if (term.length < 2) return [];
    if (!ctx) {
      throw new BadRequestException('Contexto de usuario no disponible.');
    }
    const institution = await this.requireInstitutionIe(ctx);
    const rows = await this.institutionRepo
      .createQueryBuilder('i')
      .where('i.id <> :own', { own: institution.id })
      .andWhere(
        `(i.nombre ILIKE :q OR i.codigoModular ILIKE :q OR i.siglas ILIKE :q)`,
        { q: `%${term}%` },
      )
      .orderBy('i.nombre', 'ASC')
      .take(15)
      .getMany();
    return rows.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      codigoModular: i.codigoModular,
      ugel: i.ugel ?? '',
      dre: i.dre ?? '',
    }));
  }

  async create(dto: CreateTransferRequestDto, ctx: TransferActorContext) {
    this.assertSolicitar(ctx);
    const institution = await this.requireInstitutionIe(ctx);
    const scope = await this.resolveScope(ctx);
    this.assertOrigenConfigurado(institution);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const requests = manager.getRepository(TransferRequest);
        const key = dto.idempotencyKey?.trim();
        if (key) {
          const previa = await requests.findOne({ where: { idempotencyKey: key } });
          if (previa) {
            this.assertEnAlcance(previa, scope);
            const children = await this.loadChildren(manager, previa.id);
            const evidenciaDetalle = await this.buildEvidenciaDetalle(previa);
            return this.toDetail(previa, children, true, null, evidenciaDetalle);
          }
        }

        const student = await manager.getRepository(Student).findOneBy({ id: dto.studentId });
        this.assertEstudiante(student, institution);
        const evidencia = await this.resolverEvidenciaInput(student!.id, dto);
        const destinoIe = await this.resolverDestino(manager, dto.ieDestinoCodigoModular, institution);
        this.assertPlazo(dto.plazoHasta);

        const anio = Number(institution.anio) || new Date().getFullYear();
        const destino = destinoIe.codigoModular.trim();
        const duplicada = await requests.findOne({
          where: {
            studentId: student!.id,
            anioEscolar: anio,
            ieDestinoCodigoModular: destino,
            estado: In(ESTADOS_TRASLADO_ACTIVOS),
          },
        });
        if (duplicada) {
          throw new ConflictException(
            `Ya existe la solicitud ${duplicada.codigo || duplicada.id} para este estudiante y la IE de destino en el año ${anio}.`,
          );
        }

        const actor = parseActorFromRequest(ctx.req);
        const saved = await requests.save(
          requests.create({
            codigo: '',
            studentId: student!.id,
            studentCodigo: student!.codigo,
            studentNombre: `${student!.apellido}, ${student!.nombre}`.trim(),
            studentDni: student!.dni.trim(),
            anioEscolar: anio,
            estado: 'borrador',
            ieOrigenNombre: institution.nombre,
            ieOrigenCodigoModular: institution.codigoModular.trim(),
            ieOrigenUgel: institution.ugel ?? '',
            ieOrigenDre: institution.dre ?? '',
            ieOrigenInstitutionId: institution.id,
            ieDestinoNombre: destinoIe.nombre,
            ieDestinoCodigoModular: destino,
            ieDestinoUgel: destinoIe.ugel ?? '',
            ieDestinoDre: destinoIe.dre ?? '',
            ieDestinoInstitutionId: destinoIe.id,
            motivo: dto.motivo.trim(),
            observacion: dto.observacion?.trim() ?? '',
            plazoHasta: dto.plazoHasta.slice(0, 10),
            evidencia: evidencia.evidencia,
            evidenciaTipo: evidencia.tipo === 'legacy' ? null : evidencia.tipo,
            evidenciaDocumentId: evidencia.documentId,
            evidenciaReferencia: evidencia.referencia ?? '',
            idempotencyKey: key || null,
            actorUserId: actor.usuarioId,
            actorNombre: actor.usuarioNombre,
            actorRol: actor.usuarioRol,
          }),
        );
        saved.codigo = codigoTraslado(anio, saved.id);
        const withCode = await requests.save(saved);
        const event = await this.appendEvent(manager, withCode, {
          accion: 'crear',
          estadoAnterior: null,
          estadoNuevo: 'borrador',
          motivo: withCode.motivo,
          observacion: withCode.observacion,
          cambios: {
            anterior: null,
            nuevo: {
              estado: 'borrador',
              ieDestinoCodigoModular: withCode.ieDestinoCodigoModular,
              plazoHasta: withCode.plazoHasta,
            },
          },
          ctx,
        });
        this.audit(ctx, 'crear', withCode, 'Creó solicitud de traslado en borrador', {
          estadoAnterior: null,
          estadoNuevo: 'borrador',
        });
        const evidenciaDetalle = await this.buildEvidenciaDetalle(withCode);
        return this.toDetail(
          withCode,
          { eventos: [event], notificaciones: [] },
          false,
          null,
          evidenciaDetalle,
        );
      });
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateTransferRequestDto, ctx: TransferActorContext) {
    this.assertSolicitar(ctx);
    const institution = await this.requireInstitutionIe(ctx);
    const scope = await this.resolveScope(ctx);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const requests = manager.getRepository(TransferRequest);
        const row = await requests.findOneBy({ id });
        if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
        this.assertEnAlcance(row, scope);
        this.assertEsOrigen(row, institution);
        if (row.estado !== 'borrador' && row.estado !== 'observada') {
          throw new BadRequestException(
            'Solo se puede editar una solicitud en borrador u observada.',
          );
        }
        const anterior = this.snapshot(row);
        if (dto.ieDestinoCodigoModular) {
          const destinoIe = await this.resolverDestino(
            manager,
            dto.ieDestinoCodigoModular,
            institution,
          );
          row.ieDestinoCodigoModular = destinoIe.codigoModular.trim();
          row.ieDestinoNombre = destinoIe.nombre;
          row.ieDestinoUgel = destinoIe.ugel ?? '';
          row.ieDestinoDre = destinoIe.dre ?? '';
          row.ieDestinoInstitutionId = destinoIe.id;
        }
        if (dto.motivo) row.motivo = dto.motivo.trim();
        if (dto.observacion !== undefined) row.observacion = dto.observacion.trim();
        if (
          dto.evidenciaTipo ||
          dto.evidenciaDocumentId != null ||
          dto.evidenciaReferencia != null ||
          dto.evidencia
        ) {
          const evidencia = await this.resolverEvidenciaInput(row.studentId, dto);
          row.evidencia = evidencia.evidencia;
          row.evidenciaTipo = evidencia.tipo === 'legacy' ? null : evidencia.tipo;
          row.evidenciaDocumentId = evidencia.documentId;
          row.evidenciaReferencia = evidencia.referencia ?? '';
        }
        if (dto.plazoHasta) {
          this.assertPlazo(dto.plazoHasta);
          row.plazoHasta = dto.plazoHasta.slice(0, 10);
        }
        const duplicada = await requests.findOne({
          where: {
            studentId: row.studentId,
            anioEscolar: row.anioEscolar,
            ieDestinoCodigoModular: row.ieDestinoCodigoModular,
            estado: In(ESTADOS_TRASLADO_ACTIVOS),
          },
        });
        if (duplicada && duplicada.id !== row.id) {
          throw new ConflictException(
            `Ya existe la solicitud ${duplicada.codigo} hacia esa IE de destino.`,
          );
        }
        const saved = await requests.save(row);
        const event = await this.appendEvent(manager, saved, {
          accion: 'actualizar',
          estadoAnterior: saved.estado,
          estadoNuevo: saved.estado,
          motivo: saved.motivo,
          observacion: saved.observacion,
          cambios: { anterior, nuevo: this.snapshot(saved) },
          ctx,
        });
        this.audit(ctx, 'actualizar', saved, 'Actualizó la solicitud de traslado sin alterar la matrícula', {
          estadoAnterior: saved.estado,
          estadoNuevo: saved.estado,
        });
        const children = await this.loadChildren(manager, saved.id);
        children.eventos = children.eventos.length ? children.eventos : [event];
        const evidenciaDetalle = await this.buildEvidenciaDetalle(saved);
        return this.toDetail(saved, children, false, null, evidenciaDetalle);
      });
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async registerMotivo(id: number, dto: RegisterTransferMotivoDto, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const motivo = dto.motivo.trim();
    const observacion = dto.observacion?.trim() ?? '';
    const key = dto.idempotencyKey?.trim();

    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(TransferRequest);
      const events = manager.getRepository(TransferRequestEvent);
      const row = await requests.findOneBy({ id });
      if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
      this.assertEnAlcance(row, scope);
      this.assertPuedeRegistrarMotivo(row, scope, ctx);

      if (key) {
        const previos = await events.find({
          where: { transferRequestId: row.id, accion: ACCION_REGISTRAR_MOTIVO },
          order: { createdAt: 'DESC', id: 'DESC' },
          take: 20,
        });
        const previo = previos.find(
          (e) => (e.cambios as { idempotencyKey?: string })?.idempotencyKey === key,
        );
        if (previo) {
          const children = await this.loadChildren(manager, row.id);
          const evidenciaDetalle = await this.buildEvidenciaDetalle(row);
          const transparencia = await this.buildTransparenciaSnapshot(row, children.eventos);
          return this.toDetail(row, children, true, null, evidenciaDetalle, transparencia);
        }
      }

      const duplicado = await events
        .createQueryBuilder('e')
        .where('e."transferRequestId" = :id', { id: row.id })
        .andWhere('e.accion = :accion', { accion: ACCION_REGISTRAR_MOTIVO })
        .andWhere('LOWER(TRIM(e.motivo)) = LOWER(:motivo)', { motivo })
        .andWhere(`e."createdAt" > NOW() - INTERVAL '5 minutes'`)
        .getOne();
      if (duplicado) {
        throw new ConflictException('Ya registró el mismo motivo hace instantes. Consulte el historial.');
      }

      const observacionAnterior = row.observacion;
      if (observacion) row.observacion = observacion;
      const saved = await requests.save(row);

      await this.appendEvent(manager, saved, {
        accion: ACCION_REGISTRAR_MOTIVO,
        estadoAnterior: saved.estado,
        estadoNuevo: saved.estado,
        motivo,
        observacion,
        cambios: {
          anterior: { observacion: observacionAnterior },
          nuevo: { observacion: saved.observacion, motivoRegistrado: motivo },
          idempotencyKey: key ?? null,
        },
        ctx,
      });

      this.audit(ctx, 'actualizar', saved, 'Registró motivo en la solicitud de traslado', {
        estado: saved.estado,
        motivo,
        observacionNueva: observacion || undefined,
      });

      const children = await this.loadChildren(manager, saved.id);
      const evidenciaDetalle = await this.buildEvidenciaDetalle(saved);
      const transparencia = await this.buildTransparenciaSnapshot(saved, children.eventos);
      return this.toDetail(saved, children, false, null, evidenciaDetalle, transparencia);
    });
  }

  async transition(id: number, dto: TransitionTransferRequestDto, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    const institution = scope.institution;
    const accion = dto.accion;
    if (
      ACCIONES_TRASLADO_MOTIVO_OBLIGATORIO.includes(accion) &&
      (dto.motivo?.trim().length ?? 0) < 5
    ) {
      throw new BadRequestException('Indique el motivo de la transición (mínimo 5 caracteres).');
    }

    const { detail, entregaPendiente } = await this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(TransferRequest);
      const row = await requests.findOneBy({ id });
      if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
      this.assertEnAlcance(row, scope);
      const permiso = permisoDeAccion(accion);
      if (permiso === 'solicitar') {
        this.assertSolicitar(ctx);
        if (!institution) {
          throw new BadRequestException(
            'Seleccione la institución educativa activa para operar traslados.',
          );
        }
        this.assertEsOrigen(row, institution);
      } else if (permiso === 'aprobar_destino') {
        this.assertAprobarRechazar(row, scope, ctx);
      } else {
        this.assertResolver(ctx);
      }
      const destino = siguienteEstado(row.estado, accion);
      if (!destino) {
        throw new BadRequestException(
          `Transición no permitida: ${row.estado} no puede ${accion}.`,
        );
      }
      if (accion === 'enviar') {
        assertEvidenciaListaParaEnviar(row);
        const student = await manager.getRepository(Student).findOneBy({ id: row.studentId });
        if (!institution) {
          throw new BadRequestException(
            'Seleccione la institución educativa activa para operar traslados.',
          );
        }
        this.assertEstudiante(student, institution);
        this.assertPlazo(row.plazoHasta);
      }
      let vacanteSnapshot: TransferVacancySnapshot | null = null;
      if (accion === 'aprobar') {
        await this.assertValidacionAprobacionDestino(manager, row);
        const student = await manager.getRepository(Student).findOneBy({ id: row.studentId });
        if (!student) throw new NotFoundException('Estudiante no encontrado');
        vacanteSnapshot = await this.transferVacancy.assertVacanteDestino(
          row,
          student,
          dto.seccionDestino,
        );
        if (vacanteSnapshot.seccionAsignada) {
          row.seccionDestino = vacanteSnapshot.seccionAsignada;
        }
      }
      let matriculaOrigen: Awaited<
        ReturnType<TransferRequestService['cerrarMatriculaOrigen']>
      > | null = null;
      let matriculaDestino: Awaited<
        ReturnType<TransferEnrollmentService['registrarMatriculaDestino']>
      > | null = null;
      if (accion === 'concluir') {
        this.transferEnrollment.assertListoParaConcluir(row);
        matriculaOrigen = await this.cerrarMatriculaOrigen(manager, row);
        matriculaDestino = await this.transferEnrollment.registrarMatriculaDestino(
          manager,
          row,
        );
      }
      const anterior = row.estado;
      row.estado = destino;
      if (dto.observacion?.trim()) row.observacion = dto.observacion.trim();
      const saved = await requests.save(row);
      const motivo = dto.motivo?.trim() || saved.motivo;
      await this.appendEvent(manager, saved, {
        accion,
        estadoAnterior: anterior,
        estadoNuevo: destino,
        motivo,
        observacion: dto.observacion?.trim() ?? '',
        cambios: {
          anterior: {
            estado: anterior,
            ...matriculaOrigen?.anterior,
            ...(matriculaDestino ? { matriculaDestino: matriculaDestino.anterior } : {}),
          },
          nuevo: {
            estado: destino,
            ...matriculaOrigen?.nuevo,
            ...(matriculaDestino ? { matriculaDestino: matriculaDestino.nuevo } : {}),
            ...(vacanteSnapshot
              ? {
                  vacante: {
                    seccionAsignada: vacanteSnapshot.seccionAsignada,
                    vacantesDisponibles: vacanteSnapshot.vacantesDisponibles,
                    vacantesEnSeccion: vacanteSnapshot.vacantesEnSeccion,
                    grado: vacanteSnapshot.grado,
                    nivel: vacanteSnapshot.nivel,
                  },
                }
              : {}),
          },
        },
        ctx,
      });
      const notificaciones = await this.notificationService.dispatchInTransaction(
        manager,
        saved,
        accion,
        anterior,
        destino,
      );
      const pendingDelivery =
        notificaciones.length > 0
          ? {
              requestId: saved.id,
              notificationIds: notificaciones.map((n) => n.id),
            }
          : null;
      this.audit(ctx, this.auditAccion(accion), saved, ACCION_TRASLADO_LABEL[accion], {
        estadoAnterior: anterior,
        estadoNuevo: destino,
        motivo,
        observacion: dto.observacion?.trim() || undefined,
      });
      const children = await this.loadChildren(manager, saved.id);
      if (!children.notificaciones.length) children.notificaciones = notificaciones;
      const evidenciaDetalle = await this.buildEvidenciaDetalle(saved);
      const transparencia = await this.buildTransparenciaSnapshot(saved, children.eventos);
      return {
        detail: this.toDetail(saved, children, false, null, evidenciaDetalle, transparencia),
        entregaPendiente: pendingDelivery,
      };
    });

    if (entregaPendiente && entregaPendiente.notificationIds.length) {
      await this.notificationService.deliverBatch(
        entregaPendiente.requestId,
        entregaPendiente.notificationIds,
      );
      const children = await this.loadChildren(this.dataSource.manager, entregaPendiente.requestId);
      detail.notificaciones = children.notificaciones.map((n) => this.notificationService.toDto(n));
    }

    return detail;
  }

  private async resolverEvidenciaInput(
    studentId: number,
    input: {
      evidenciaTipo?: EvidenciaTrasladoTipo;
      evidenciaDocumentId?: number;
      evidenciaReferencia?: string;
      evidencia?: string;
    },
  ): Promise<EvidenciaTrasladoResuelta> {
    let documento: Awaited<
      ReturnType<StudentDocumentsService['assertDocumentoEvidenciaTraslado']>
    > | null = null;
    if (input.evidenciaTipo === 'documento') {
      documento = await this.studentDocuments.assertDocumentoEvidenciaTraslado(
        studentId,
        input.evidenciaDocumentId!,
      );
    }
    return resolverEvidenciaTraslado(
      {
        tipo: input.evidenciaTipo,
        documentId: input.evidenciaDocumentId,
        referencia: input.evidenciaReferencia,
        legacyTexto: input.evidencia,
      },
      documento,
    );
  }

  private async buildEvidenciaDetalle(row: TransferRequest) {
    const documento = await this.studentDocuments.getEvidenciaTrasladoDetalle(
      row.studentId,
      row.evidenciaDocumentId,
    );
    return { evidenciaDocumento: documento };
  }

  private async buildTransparenciaSnapshot(
    row: TransferRequest,
    eventos: TransferRequestEvent[],
  ) {
    const modular = row.ieDestinoCodigoModular?.trim();
    const padronDestino = modular
      ? await this.institutionRepo.findOne({ where: { codigoModular: modular } })
      : null;
    return buildTransferSnapshotTransparency(row, eventos, padronDestino);
  }

  private async cerrarMatriculaOrigen(
    manager: EntityManager,
    row: TransferRequest,
  ): Promise<{ anterior: Record<string, unknown>; nuevo: Record<string, unknown> }> {
    const students = manager.getRepository(Student);
    const historyRepo = manager.getRepository(StudentAcademicHistory);
    const student = await students.findOne({
      where: { id: row.studentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const estadoAnterior = student.estadoMatricula;
    if (student.estadoMatricula === 'activo') {
      student.estadoMatricula = 'retirado';
      await students.save(student);
    }

    const anio = String(row.anioEscolar);
    const history = await historyRepo.findOne({
      where: { studentId: student.id, anio },
    });
    if (history) {
      history.estado = 'Trasladado';
      history.institutionId = history.institutionId ?? student.institutionId;
      history.codigoInstitucion = history.codigoInstitucion || row.ieOrigenCodigoModular;
      await historyRepo.save(history);
    } else {
      await historyRepo.save(
        historyRepo.create({
          studentId: student.id,
          anio,
          grado: student.grado,
          seccion: student.seccion,
          promedio: 0,
          estado: 'Trasladado',
          institutionId: student.institutionId,
          codigoInstitucion: row.ieOrigenCodigoModular,
        }),
      );
    }

    return {
      anterior: { estadoMatricula: estadoAnterior },
      nuevo: { estadoMatricula: student.estadoMatricula, historialAnio: 'Trasladado' },
    };
  }

  private async appendEvent(
    manager: EntityManager,
    row: TransferRequest,
    input: {
      accion: string;
      estadoAnterior: EstadoTraslado | null;
      estadoNuevo: EstadoTraslado;
      motivo: string;
      observacion: string;
      cambios: Record<string, unknown>;
      ctx: TransferActorContext;
    },
  ): Promise<TransferRequestEvent> {
    const actor = parseActorFromRequest(input.ctx.req);
    const repo = manager.getRepository(TransferRequestEvent);
    return repo.save(
      repo.create({
        transferRequestId: row.id,
        accion: input.accion,
        estadoAnterior: input.estadoAnterior,
        estadoNuevo: input.estadoNuevo,
        motivo: input.motivo,
        observacion: input.observacion,
        cambios: input.cambios,
        actorUserId: actor.usuarioId,
        actorNombre: actor.usuarioNombre,
        actorRol: actor.usuarioRol,
        ip: getClientIp(input.ctx.req),
        correlationId: getCorrelationId(input.ctx.req),
      }),
    );
  }

  private async loadChildren(manager: EntityManager, id: number) {
    const eventos = await manager.getRepository(TransferRequestEvent).find({
      where: { transferRequestId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const notificaciones = await manager.getRepository(TransferNotification).find({
      where: { transferRequestId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return { eventos, notificaciones };
  }

  private async assertValidacionAprobacionDestino(
    manager: EntityManager,
    row: TransferRequest,
  ): Promise<void> {
    const institutions = manager.getRepository(Institution);
    const origin =
      row.ieOrigenInstitutionId != null
        ? await institutions.findOneBy({ id: row.ieOrigenInstitutionId })
        : await institutions.findOneBy({ codigoModular: row.ieOrigenCodigoModular });
    const student = await manager.getRepository(Student).findOneBy({ id: row.studentId });
    this.assertEstudiante(student, origin ?? undefined);
    if (student!.dni.trim() !== row.studentDni.trim()) {
      throw new BadRequestException(
        'El documento del estudiante no coincide con la solicitud de traslado.',
      );
    }
    this.assertPlazo(row.plazoHasta);
    const duplicada = await manager.getRepository(TransferRequest).findOne({
      where: {
        id: Not(row.id),
        studentId: row.studentId,
        anioEscolar: row.anioEscolar,
        ieDestinoCodigoModular: row.ieDestinoCodigoModular,
        estado: In(['aprobada', 'concluida']),
      },
    });
    if (duplicada) {
      throw new ConflictException(
        `Ya existe el traslado ${duplicada.codigo || duplicada.id} aprobado o concluido para este estudiante.`,
      );
    }
  }

  private assertEstudiante(
    student: Student | null,
    institution?: Institution,
  ): asserts student is Student {
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (!student.activo || student.estadoMatricula !== 'activo') {
      throw new BadRequestException(
        'El estudiante no tiene matrícula vigente en la IE de origen.',
      );
    }
    if (!student.dni?.trim()) {
      throw new BadRequestException('El estudiante no tiene documento de identidad registrado.');
    }
    if (
      institution &&
      student.institutionId &&
      student.institutionId !== institution.id
    ) {
      throw new BadRequestException('El estudiante no está matriculado en esta IE.');
    }
  }

  private async resolverDestino(
    manager: EntityManager,
    codigo: string,
    institution: Institution,
  ): Promise<Institution> {
    const modular = codigo.trim();
    if (modular === (institution.codigoModular ?? '').trim()) {
      throw new BadRequestException('La IE de destino debe ser distinta de la IE de origen.');
    }
    const destino = await manager.getRepository(Institution).findOne({
      where: { codigoModular: modular },
    });
    if (!destino) {
      throw new BadRequestException(
        'La IE de destino no está en el padrón. Búsquela por nombre o código modular.',
      );
    }
    return destino;
  }

  private assertEsOrigen(row: TransferRequest, institution: Institution): void {
    if (row.ieOrigenCodigoModular !== (institution.codigoModular ?? '').trim()) {
      throw new ForbiddenException(
        'Enviar, editar o cancelar corresponde a la IE de origen.',
      );
    }
  }

  private assertEsDestino(row: TransferRequest, institution: Institution): void {
    if (row.ieDestinoCodigoModular !== (institution.codigoModular ?? '').trim()) {
      throw new ForbiddenException('Aprobar o rechazar corresponde a la IE de destino.');
    }
  }

  private assertPuedeRegistrarMotivo(
    row: TransferRequest,
    scope: ResolvedTransferTerritorialScope,
    ctx: TransferActorContext,
  ): void {
    if (ESTADOS_TRASLADO_TERMINALES.includes(row.estado)) {
      throw new BadRequestException(
        'No se puede registrar motivo en una solicitud rechazada, cancelada o concluida.',
      );
    }
    if (ctx.esAdmin) return;

    const modular = (scope.institution?.codigoModular ?? '').trim();
    const esOrigen = row.ieOrigenCodigoModular === modular;
    const esDestino =
      row.ieDestinoCodigoModular === modular && row.ieOrigenCodigoModular !== modular;
    const esTerritorial =
      ctx.permisos.includes(PERMISO_TRASLADOS_RESOLVER) &&
      ctx.ambitos.some((a) => a === 'UGEL' || a === 'DRE' || a === 'MINEDU');

    if (esTerritorial) return;
    if (esOrigen && ctx.permisos.includes(PERMISO_TRASLADOS_SOLICITAR) && ctx.ambitos.includes('IE')) {
      return;
    }
    if (
      esDestino &&
      ctx.permisos.includes(PERMISO_TRASLADOS_APROBAR_DESTINO) &&
      ctx.ambitos.includes('IE') &&
      row.estado !== 'borrador'
    ) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para registrar motivo en esta solicitud.');
  }

  private assertAprobarRechazar(
    row: TransferRequest,
    scope: ResolvedTransferTerritorialScope,
    ctx: TransferActorContext,
  ): void {
    if (ctx.esAdmin) return;
    const institution = scope.institution;
    const modular = (institution?.codigoModular ?? '').trim();
    const esOrigen = !!modular && row.ieOrigenCodigoModular === modular;
    const esDestino = !!modular && row.ieDestinoCodigoModular === modular;
    const esTerritorial =
      ctx.permisos.includes(PERMISO_TRASLADOS_RESOLVER) &&
      ctx.ambitos.some((a) => a === 'UGEL' || a === 'DRE' || a === 'MINEDU');
    const puedeDestino =
      ctx.permisos.includes(PERMISO_TRASLADOS_APROBAR_DESTINO) &&
      ctx.ambitos.includes('IE') &&
      esDestino;

    if (esOrigen && !esTerritorial) {
      throw new ForbiddenException('La IE de origen no puede aprobar ni rechazar la solicitud.');
    }
    if (puedeDestino) {
      if (!institution) {
        throw new BadRequestException(
          'Seleccione la institución educativa activa para operar traslados.',
        );
      }
      this.assertEsDestino(row, institution);
      return;
    }
    if (esTerritorial) return;
    throw new ForbiddenException(
      'Aprobar o rechazar requiere ser la IE de destino autorizada o el ámbito UGEL, DRE o MINEDU.',
    );
  }

  private assertPlazo(plazoHasta: string): void {
    const plazo = plazoHasta.slice(0, 10);
    if (plazo < hoyLima()) {
      throw new BadRequestException('El plazo de la solicitud ya venció.');
    }
  }

  private assertOrigenConfigurado(institution: Institution): void {
    if (!institution.codigoModular?.trim()) {
      throw new BadRequestException('La IE de origen no tiene código modular configurado.');
    }
  }

  private assertSolicitar(ctx: TransferActorContext): void {
    if (ctx.esAdmin) return;
    if (!ctx.permisos.includes(PERMISO_TRASLADOS_SOLICITAR)) {
      throw new ForbiddenException('No tiene permiso para solicitar traslados.');
    }
    if (!ctx.ambitos.includes('IE')) {
      throw new ForbiddenException(
        'La solicitud de traslado de origen solo puede registrarla el ámbito IE.',
      );
    }
  }

  private assertResolver(ctx: TransferActorContext): void {
    if (ctx.esAdmin) return;
    if (!ctx.permisos.includes(PERMISO_TRASLADOS_RESOLVER)) {
      throw new ForbiddenException('No tiene permiso para resolver traslados.');
    }
    const ok = ctx.ambitos.some((a) => a === 'UGEL' || a === 'DRE' || a === 'MINEDU');
    if (!ok) {
      throw new ForbiddenException(
        'Observar, aprobar, rechazar o concluir corresponde a UGEL, DRE o MINEDU.',
      );
    }
  }

  private async loadInstitutionReference(
    ctx?: TransferActorContext,
  ): Promise<Institution | null> {
    if (!ctx?.institutionId) return null;
    const institution = await this.institutionRepo.findOneBy({ id: ctx.institutionId });
    if (!institution) {
      throw new BadRequestException(
        `Institución educativa ${ctx.institutionId} no encontrada.`,
      );
    }
    return institution;
  }

  private async resolveScope(ctx?: TransferActorContext): Promise<ResolvedTransferTerritorialScope> {
    if (!ctx) {
      throw new BadRequestException('Contexto de usuario no disponible.');
    }
    const institution = await this.loadInstitutionReference(ctx);
    return resolverAlcanceTerritorial(ctx, institution);
  }

  private async requireInstitutionIe(ctx: TransferActorContext): Promise<Institution> {
    const scope = await this.resolveScope(ctx);
    if (!scope.institution || scope.nivel !== 'IE') {
      throw new BadRequestException(
        'Seleccione la institución educativa activa para operar traslados.',
      );
    }
    return scope.institution;
  }

  private assertEnAlcance(
    row: TransferRequest,
    scope: ResolvedTransferTerritorialScope,
  ): void {
    if (solicitudFueraDeAlcance(row, scope)) {
      throw new NotFoundException('Solicitud de traslado no encontrada');
    }
  }

  private snapshot(row: TransferRequest) {
    return {
      ieDestinoNombre: row.ieDestinoNombre,
      ieDestinoCodigoModular: row.ieDestinoCodigoModular,
      ieDestinoUgel: row.ieDestinoUgel,
      ieDestinoDre: row.ieDestinoDre,
      motivo: row.motivo,
      observacion: row.observacion,
      plazoHasta: row.plazoHasta,
      evidencia: row.evidencia,
      estado: row.estado,
    };
  }

  private audit(
    ctx: TransferActorContext,
    accion: AuditAccion,
    row: TransferRequest,
    descripcion: string,
    extra: Record<string, unknown>,
  ): void {
    const actor = parseActorFromRequest(ctx.req);
    this.auditLogger.log({
      accion,
      modulo: 'traslados',
      entidad: 'solicitud_traslado',
      entidadId: String(row.id),
      descripcion: `${descripcion} ${row.codigo}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip: getClientIp(ctx.req),
      correlationId: getCorrelationId(ctx.req),
      resultado: 'success',
      detalle: {
        codigo: row.codigo,
        studentId: row.studentId,
        ...extra,
      },
    });
  }

  private auditAccion(accion: AccionTraslado): AuditAccion {
    if (accion === 'aprobar' || accion === 'concluir') return 'aprobar';
    if (accion === 'rechazar') return 'rechazar';
    return 'actualizar';
  }

  private rethrowUnique(error: unknown): void {
    const pg = error as { code?: string; driverError?: { code?: string } };
    const code = pg?.code ?? pg?.driverError?.code;
    if (error instanceof QueryFailedError && code === '23505') {
      throw new ConflictException(
        'Ya existe una solicitud activa para ese estudiante y esa IE de destino.',
      );
    }
  }

  private async historialAcademico(studentId: number) {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    const trayectoria = await this.dataSource.getRepository(StudentAcademicHistory).find({
      where: { studentId },
      order: { anio: 'ASC' },
    });
    return {
      estudiante: student
        ? {
            id: student.id,
            nombres: student.nombre,
            apellidos: student.apellido,
            dni: student.dni,
            nivel: student.nivel,
            grado: student.grado,
            seccion: student.seccion,
            estadoMatricula: student.estadoMatricula,
            anioIngreso: student.anioIngreso,
          }
        : null,
      trayectoria: trayectoria.map((h) => ({
        anio: h.anio,
        grado: h.grado,
        seccion: h.seccion,
        promedio: h.promedio,
        estado: h.estado,
        codigoInstitucion: h.codigoInstitucion,
      })),
    };
  }

  private toSummary(row: TransferRequest) {
    return {
      id: row.id,
      codigo: row.codigo,
      studentId: row.studentId,
      studentCodigo: row.studentCodigo,
      studentNombre: row.studentNombre,
      studentDni: row.studentDni,
      anioEscolar: row.anioEscolar,
      estado: row.estado,
      ieOrigenNombre: row.ieOrigenNombre,
      ieOrigenCodigoModular: row.ieOrigenCodigoModular,
      ieDestinoNombre: row.ieDestinoNombre,
      ieDestinoCodigoModular: row.ieDestinoCodigoModular,
      plazoHasta: row.plazoHasta,
      createdAt: row.createdAt,
    };
  }

  private toDetail(
    row: TransferRequest,
    children: { eventos: TransferRequestEvent[]; notificaciones: TransferNotification[] },
    recuperada: boolean,
    historialAcademico: Awaited<ReturnType<TransferRequestService['historialAcademico']>> | null = null,
    evidenciaDetalle: Awaited<ReturnType<TransferRequestService['buildEvidenciaDetalle']>> | null = null,
    transparencia: Awaited<ReturnType<TransferRequestService['buildTransparenciaSnapshot']>> | null = null,
  ) {
    return {
      ...this.toSummary(row),
      recuperada,
      historialAcademico,
      transparencia,
      ieOrigenUgel: row.ieOrigenUgel,
      ieOrigenDre: row.ieOrigenDre,
      ieDestinoUgel: row.ieDestinoUgel,
      ieDestinoDre: row.ieDestinoDre,
      motivo: row.motivo,
      observacion: row.observacion,
      evidencia: row.evidencia,
      evidenciaTipo: row.evidenciaTipo,
      evidenciaDocumentId: row.evidenciaDocumentId,
      evidenciaReferencia: row.evidenciaReferencia,
      evidenciaDocumento: evidenciaDetalle?.evidenciaDocumento ?? null,
      seccionDestino: row.seccionDestino,
      matriculaDestino:
        row.estado === 'concluida' && row.seccionDestino
          ? {
              studentId: row.studentId,
              institutionId: row.ieDestinoInstitutionId,
              codigoModular: row.ieDestinoCodigoModular,
              seccion: row.seccionDestino,
            }
          : null,
      actorNombre: row.actorNombre,
      actorRol: row.actorRol,
      updatedAt: row.updatedAt,
      eventos: children.eventos.map((e) => ({
        id: e.id,
        accion: e.accion,
        estadoAnterior: e.estadoAnterior,
        estadoNuevo: e.estadoNuevo,
        motivo: e.motivo,
        observacion: e.observacion,
        cambios: e.cambios,
        actorNombre: e.actorNombre,
        actorRol: e.actorRol,
        createdAt: e.createdAt,
      })),
      notificaciones: children.notificaciones.map((n) => this.notificationService.toDto(n)),
    };
  }
}
