import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { institutionIdDeAlcance } from '../auth/siagie-access.util';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  CreateTransferRequestDto,
  RegisterTransferMotivoDto,
  TransitionTransferRequestDto,
  UpdateTransferRequestDto,
} from './dto/transfer-request.dto';
import {
  ListMyTransferNotificationsQueryDto,
  ListTransferNotificationsQueryDto,
  RetryTransferNotificationsDto,
} from './dto/transfer-notification.dto';
import { TransferNotificationService } from './transfer-notification.service';
import { TransferActorContext, TransferRequestService } from './transfer-request.service';
import {
  PERMISO_TRASLADOS_APROBAR_DESTINO,
  PERMISO_TRASLADOS_RESOLVER,
  PERMISO_TRASLADOS_SOLICITAR,
  PERMISO_TRASLADOS_VER,
} from './transfer.constants';

type AuthRequest = Request & { user?: RequestUser };

@Controller('transfer-requests')
export class TransferRequestController {
  constructor(
    private readonly transfers: TransferRequestService,
    private readonly notifications: TransferNotificationService,
  ) {}

  @Get('context')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  getContext(@Req() req: AuthRequest) {
    return this.transfers.getContext(this.actor(req));
  }

  @Get('students')
  @RequirePermiso(PERMISO_TRASLADOS_SOLICITAR, PERMISO_TRASLADOS_VER)
  searchStudents(@Req() req: AuthRequest, @Query('q') q = '') {
    return this.transfers.searchStudents(q, this.actor(req));
  }

  @Get('institutions')
  @RequirePermiso(PERMISO_TRASLADOS_SOLICITAR, PERMISO_TRASLADOS_VER)
  searchInstitutions(@Req() req: AuthRequest, @Query('q') q = '') {
    return this.transfers.searchInstitutions(q, this.actor(req));
  }

  @Get()
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  findAll(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('estado') estado?: string,
    @Query('q') q?: string,
    @Query('alcance') alcance?: string,
    @Query('pendientes') pendientes?: string,
    @Query('activos') activos?: string,
  ) {
    return this.transfers.findAll(this.actor(req), {
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 20,
      estado,
      q,
      alcance,
      pendientes: pendientes === 'true' || pendientes === '1',
      activos: activos === 'true' || activos === '1',
    });
  }

  @Get('notifications/mine')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  listMyNotifications(
    @Query() query: ListMyTransferNotificationsQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.notifications.listMine(this.actor(req), {
      page: query.page,
      pageSize: query.pageSize,
      soloPendientes: query.soloPendientes === true || `${query.soloPendientes}` === 'true',
    });
  }

  @Get(':id/seguimiento')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  getSeguimiento(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.transfers.getSeguimiento(id, this.actor(req));
  }

  @Get(':id/vacante-destino')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
    PERMISO_TRASLADOS_RESOLVER,
  )
  getVacanteDestino(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.transfers.getVacanteDestino(id, this.actor(req));
  }

  @Get(':id')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.transfers.findOne(id, this.actor(req));
  }

  @Post()
  @RequirePermiso(PERMISO_TRASLADOS_SOLICITAR)
  create(@Body() dto: CreateTransferRequestDto, @Req() req: AuthRequest) {
    return this.transfers.create(dto, this.actor(req));
  }

  @Patch(':id')
  @RequirePermiso(PERMISO_TRASLADOS_SOLICITAR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransferRequestDto,
    @Req() req: AuthRequest,
  ) {
    return this.transfers.update(id, dto, this.actor(req));
  }

  @Post(':id/motivo')
  @HttpCode(201)
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  registerMotivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegisterTransferMotivoDto,
    @Req() req: AuthRequest,
  ) {
    return this.transfers.registerMotivo(id, dto, this.actor(req));
  }

  @Post(':id/transition')
  @RequirePermiso(
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionTransferRequestDto,
    @Req() req: AuthRequest,
  ) {
    return this.transfers.transition(id, dto, this.actor(req));
  }

  @Get(':id/notifications')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  listNotifications(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListTransferNotificationsQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.notifications.list(id, this.actor(req), query);
  }

  @Patch(':id/notifications/:notificationId/read')
  @RequirePermiso(
    PERMISO_TRASLADOS_VER,
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  markNotificationRead(
    @Param('id', ParseIntPipe) id: number,
    @Param('notificationId', ParseIntPipe) notificationId: number,
    @Req() req: AuthRequest,
  ) {
    return this.notifications.markRead(id, notificationId, this.actor(req));
  }

  @Post(':id/notifications/retry')
  @RequirePermiso(
    PERMISO_TRASLADOS_SOLICITAR,
    PERMISO_TRASLADOS_RESOLVER,
    PERMISO_TRASLADOS_APROBAR_DESTINO,
  )
  retryNotifications(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RetryTransferNotificationsDto,
    @Req() req: AuthRequest,
  ) {
    return this.notifications.retry(id, this.actor(req), dto.notificationId);
  }

  private actor(req: AuthRequest): TransferActorContext {
    return {
      req,
      permisos: req.user?.permisos ?? [],
      ambitos: req.user?.ambitos ?? [],
      esAdmin: req.user?.esAdmin ?? false,
      institutionId:
        institutionIdDeAlcance(req.user, req) ?? req.user?.institutionId ?? null,
      ugelCodigo: req.user?.ugelCodigo ?? null,
      dreCodigo: req.user?.dreCodigo ?? null,
    };
  }
}
