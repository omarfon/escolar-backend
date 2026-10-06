import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { EstadoEntregaNotificacion } from '../transfer-notification.constants';

const ESTADOS_ENTREGA: EstadoEntregaNotificacion[] = [
  'pendiente',
  'enviado',
  'entregado',
  'fallido',
];

export class ListTransferNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(ESTADOS_ENTREGA)
  estadoEntrega?: EstadoEntregaNotificacion;
}

export class ListMyTransferNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  soloPendientes?: boolean;
}

export class RetryTransferNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  notificationId?: number;
}
