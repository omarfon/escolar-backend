import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import type { AuditAccion } from '../audit-logs/entities/audit-log.entity';
import { Institution } from '../institution/entities/institution.entity';
import { TransferNotification } from './entities/transfer-notification.entity';
import { TransferRequest } from './entities/transfer-request.entity';
import type { AccionTraslado, EstadoTraslado } from './transfer.constants';
import { TransferNotificationDeliveryService } from './transfer-notification-delivery.service';
import {
  marcarEntregaInApp,
  puedeReintentarEntrega,
  valoresInicialesEntrega,
} from './transfer-notification-delivery.util';
import {
  nivelAlcanceDesdeContexto,
  usuarioEsDestinatarioNotificacion,
} from './transfer-notification-access.util';
import { planificarNotificacionesTraslado } from './transfer-notification.template.util';
import { TransferRecipientResolverService } from './transfer-recipient-resolver.service';
import type { TransferActorContext } from './transfer-actor.interface';
import {
  resolverAlcanceTerritorial,
  solicitudFueraDeAlcance,
  type ResolvedTransferTerritorialScope,
} from './transfer-territorial-scope.util';

@Injectable()
export class TransferNotificationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(TransferNotification)
    private readonly notificationRepo: Repository<TransferNotification>,
    @InjectRepository(TransferRequest)
    private readonly requestRepo: Repository<TransferRequest>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly auditLogger: AuditLoggerService,
    private readonly recipientResolver: TransferRecipientResolverService,
    private readonly deliveryService: TransferNotificationDeliveryService,
  ) {}

  async dispatchInTransaction(
    manager: EntityManager,
    row: TransferRequest,
    accion: AccionTraslado | 'crear',
    estadoAnterior: EstadoTraslado | null,
    estadoNuevo: EstadoTraslado,
  ): Promise<TransferNotification[]> {
    const repo = manager.getRepository(TransferNotification);
    const planes = planificarNotificacionesTraslado(row, accion, estadoAnterior, estadoNuevo);
    const saved: TransferNotification[] = [];

    for (const plan of planes) {
      const recipients = await this.recipientResolver.resolveRecipients(row, plan.ambito);
      if (!recipients.length) {
        throw new BadRequestException(
          `No hay destinatarios resolubles para la notificación ${plan.plantilla} (${plan.ambito}).`,
        );
      }

      for (const recipient of recipients) {
        const idempotencyKey = `${plan.idempotencyKey}:u${recipient.destinatarioUserId}`;
        const existing = await repo.findOne({
          where: { transferRequestId: row.id, idempotencyKey },
        });
        if (existing) {
          saved.push(existing);
          continue;
        }

        let notification = repo.create({
          transferRequestId: row.id,
          plantilla: plan.plantilla,
          ambito: plan.ambito,
          destinatario: recipient.destinatario,
          destinatarioTipo: recipient.destinatarioTipo,
          destinatarioUserId: recipient.destinatarioUserId,
          destinatarioEmail: recipient.destinatarioEmail,
          destinatarioInstitutionId: recipient.destinatarioInstitutionId,
          destinatarioAmbitoNivel: recipient.destinatarioAmbitoNivel,
          destinatarioRol: recipient.destinatarioRol,
          mensaje: plan.mensaje,
          estadoAnterior,
          estadoNuevo,
          idempotencyKey,
          leida: false,
          ...valoresInicialesEntrega(),
        });
        saved.push(await repo.save(notification));
      }
    }

    return saved;
  }

  async deliverBatch(requestId: number, notificationIds: number[]): Promise<void> {
    if (!notificationIds.length) return;
    const row = await this.requestRepo.findOneBy({ id: requestId });
    if (!row) return;

    const notifications = await this.notificationRepo.find({
      where: { id: In(notificationIds) },
    });
    for (const notification of notifications) {
      if (notification.transferRequestId !== requestId) continue;
      if (notification.estadoEntrega === 'entregado') continue;
      const actualizada = await this.deliveryService.attemptEmailDelivery(notification, row);
      await this.notificationRepo.save(actualizada);
    }
  }

  async listMine(
    ctx: TransferActorContext,
    query: { page?: number; pageSize?: number; soloPendientes?: boolean },
  ) {
    const actor = parseActorFromRequest(ctx.req);
    if (!actor.usuarioId) {
      throw new ForbiddenException('Usuario no identificado para bandeja de notificaciones.');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .innerJoin(TransferRequest, 'r', 'r.id = n."transferRequestId"')
      .where('n."destinatarioUserId" = :userId', { userId: actor.usuarioId })
      .orderBy('n."createdAt"', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.soloPendientes) {
      qb.andWhere('n.leida = false');
    }

    const scope = await this.resolveScope(ctx);
    this.applyAlcanceNotificacionesMine(qb, scope);

    const [items, total] = await qb.getManyAndCount();
    const requestIds = [...new Set(items.map((n) => n.transferRequestId))];
    const requests =
      requestIds.length > 0
        ? await this.requestRepo.find({ where: { id: In(requestIds) } })
        : [];
    const requestMap = new Map(requests.map((r) => [r.id, r]));

    return {
      items: items.map((n) => ({
        ...this.toDto(n),
        transferRequestId: n.transferRequestId,
        codigo: requestMap.get(n.transferRequestId)?.codigo ?? '',
        studentNombre: requestMap.get(n.transferRequestId)?.studentNombre ?? '',
      })),
      total,
      page,
      pageSize,
    };
  }

  async list(
    requestId: number,
    ctx: TransferActorContext,
    query: { page?: number; pageSize?: number; estadoEntrega?: string },
  ) {
    const scope = await this.resolveScope(ctx);
    const row = await this.requestRepo.findOneBy({ id: requestId });
    if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
    this.assertEnAlcance(row, scope);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n."transferRequestId" = :requestId', { requestId })
      .orderBy('n."createdAt"', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.estadoEntrega) {
      qb.andWhere('n."estadoEntrega" = :estadoEntrega', { estadoEntrega: query.estadoEntrega });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((n) => this.toDto(n)),
      total,
      page,
      pageSize,
    };
  }

  async markRead(requestId: number, notificationId: number, ctx: TransferActorContext) {
    const scope = await this.resolveScope(ctx);
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(TransferRequest);
      const notifications = manager.getRepository(TransferNotification);
      const row = await requests.findOneBy({ id: requestId });
      if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
      this.assertEnAlcance(row, scope);

      const notification = await notifications.findOneBy({
        id: notificationId,
        transferRequestId: requestId,
      });
      if (!notification) throw new NotFoundException('Notificación no encontrada');

      const nivel = nivelAlcanceDesdeContexto(ctx.esAdmin, ctx.ambitos);
      const actor = parseActorFromRequest(ctx.req);
      if (
        !usuarioEsDestinatarioNotificacion(
          notification,
          row,
          this.institutionParaNotificacion(scope),
          nivel,
          actor.usuarioId,
        )
      ) {
        throw new ForbiddenException('No puede marcar como leída esta notificación.');
      }
      if (notification.leida) {
        return this.toDto(notification);
      }

      notification.leida = true;
      notification.leidoAt = new Date();
      marcarEntregaInApp(notification);
      const saved = await notifications.save(notification);

      this.audit(ctx, 'actualizar', row, 'Notificación marcada como leída', {
        notificationId: saved.id,
        plantilla: saved.plantilla,
        ambito: saved.ambito,
      });

      return this.toDto(saved);
    });
  }

  async retry(
    requestId: number,
    ctx: TransferActorContext,
    notificationId?: number,
  ) {
    this.assertPuedeReintentar(ctx);
    const scope = await this.resolveScope(ctx);

    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(TransferRequest);
      const notifications = manager.getRepository(TransferNotification);
      const row = await requests.findOneBy({ id: requestId });
      if (!row) throw new NotFoundException('Solicitud de traslado no encontrada');
      this.assertEnAlcance(row, scope);

      const qb = notifications
        .createQueryBuilder('n')
        .where('n."transferRequestId" = :requestId', { requestId });
      if (notificationId) {
        qb.andWhere('n.id = :notificationId', { notificationId });
      } else {
        qb.andWhere('n."estadoEntrega" IN (:...estados)', {
          estados: ['fallido', 'pendiente'],
        });
      }

      const candidatas = await qb.getMany();
      if (!candidatas.length) {
        throw new NotFoundException('No hay notificaciones pendientes de reintento.');
      }

      const reintentadas: TransferNotification[] = [];
      for (const notification of candidatas) {
        if (!puedeReintentarEntrega(notification)) {
          if (notificationId) {
            throw new BadRequestException(
              'La notificación no admite más reintentos o ya fue entregada.',
            );
          }
          continue;
        }
        const actualizada = await this.deliveryService.attemptEmailDelivery(notification, row);
        reintentadas.push(await notifications.save(actualizada));
      }

      if (!reintentadas.length) {
        throw new BadRequestException('Ninguna notificación pudo reintentarse.');
      }

      this.audit(ctx, 'actualizar', row, 'Reintento de notificaciones de traslado', {
        notificationIds: reintentadas.map((n) => n.id),
        resultados: reintentadas.map((n) => ({
          id: n.id,
          estadoEntrega: n.estadoEntrega,
          intentos: n.intentos,
        })),
      });

      return {
        reintentadas: reintentadas.length,
        items: reintentadas.map((n) => this.toDto(n)),
      };
    });
  }

  toDto(n: TransferNotification) {
    return {
      id: n.id,
      plantilla: n.plantilla,
      ambito: n.ambito,
      destinatario: n.destinatario,
      destinatarioTipo: n.destinatarioTipo,
      destinatarioUserId: n.destinatarioUserId,
      destinatarioEmail: n.destinatarioEmail,
      destinatarioInstitutionId: n.destinatarioInstitutionId,
      destinatarioAmbitoNivel: n.destinatarioAmbitoNivel,
      destinatarioRol: n.destinatarioRol,
      mensaje: n.mensaje,
      estadoAnterior: n.estadoAnterior,
      estadoNuevo: n.estadoNuevo,
      estadoEntrega: n.estadoEntrega,
      canalEntrega: n.canalEntrega,
      correoSimulado: n.correoSimulado,
      correoMessageId: n.correoMessageId,
      intentos: n.intentos,
      maxIntentos: n.maxIntentos,
      ultimoError: n.ultimoError,
      leida: n.leida,
      entregadoAt: n.entregadoAt,
      leidoAt: n.leidoAt,
      createdAt: n.createdAt,
    };
  }

  private assertPuedeReintentar(ctx: TransferActorContext): void {
    if (
      ctx.esAdmin ||
      ctx.permisos.includes('traslados.resolver') ||
      ctx.permisos.includes('traslados.solicitar')
    ) {
      return;
    }
    throw new ForbiddenException('No tiene permiso para reintentar notificaciones.');
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

  private async resolveScope(ctx: TransferActorContext): Promise<ResolvedTransferTerritorialScope> {
    const institution = await this.loadInstitutionReference(ctx);
    return resolverAlcanceTerritorial(ctx, institution);
  }

  private institutionParaNotificacion(
    scope: ResolvedTransferTerritorialScope,
  ): Pick<Institution, 'codigoModular' | 'ugel' | 'dre'> {
    return {
      codigoModular: scope.institution?.codigoModular ?? '',
      ugel: scope.ugel ?? scope.institution?.ugel ?? '',
      dre: scope.dre ?? scope.institution?.dre ?? '',
    };
  }

  private assertEnAlcance(
    row: TransferRequest,
    scope: ResolvedTransferTerritorialScope,
  ): void {
    if (solicitudFueraDeAlcance(row, scope)) {
      throw new NotFoundException('Solicitud de traslado no encontrada');
    }
  }

  private applyAlcanceNotificacionesMine(
    qb: ReturnType<Repository<TransferNotification>['createQueryBuilder']>,
    scope: ResolvedTransferTerritorialScope,
  ): void {
    if (scope.nivel === 'MINEDU') return;

    const modular = scope.institution?.codigoModular?.trim();
    if (scope.nivel === 'IE' && modular) {
      qb.andWhere(
        '(r."ieOrigenCodigoModular" = :modular OR r."ieDestinoCodigoModular" = :modular)',
        { modular },
      );
      return;
    }

    if (scope.nivel === 'UGEL' && scope.ugel) {
      qb.andWhere('LOWER(r."ieOrigenUgel") = LOWER(:ugel)', { ugel: scope.ugel });
      return;
    }

    if (scope.nivel === 'DRE' && scope.dre) {
      qb.andWhere('LOWER(r."ieOrigenDre") = LOWER(:dre)', { dre: scope.dre });
    }
  }

  private audit(
    ctx: TransferActorContext,
    accion: AuditAccion,
    row: TransferRequest,
    descripcion: string,
    detalle: Record<string, unknown>,
  ): void {
    const actor = parseActorFromRequest(ctx.req);
    this.auditLogger.log({
      accion,
      modulo: 'traslados',
      entidad: 'notificacion_traslado',
      entidadId: String(row.id),
      descripcion: `${descripcion} ${row.codigo}`,
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      usuarioRol: actor.usuarioRol,
      ip: getClientIp(ctx.req),
      correlationId: getCorrelationId(ctx.req),
      resultado: 'success',
      detalle,
    });
  }
}
