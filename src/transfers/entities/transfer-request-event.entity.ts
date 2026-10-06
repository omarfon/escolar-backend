import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EstadoTraslado } from '../transfer.constants';

@Entity('transfer_request_events')
export class TransferRequestEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transferRequestId: number;

  @Column({ length: 20 })
  accion: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estadoAnterior: EstadoTraslado | null;

  @Column({ type: 'varchar', length: 20 })
  estadoNuevo: EstadoTraslado;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'text', default: '' })
  observacion: string;

  @Column({ type: 'jsonb', default: {} })
  cambios: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
