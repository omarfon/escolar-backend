import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  AmbitoNotificacionTraslado,
  CanalEntregaNotificacion,
  EstadoEntregaNotificacion,
  PlantillaNotificacionTraslado,
} from '../transfer-notification.constants';

@Entity('transfer_notifications')
export class TransferNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transferRequestId: number;

  @Column({ type: 'varchar', length: 60, default: '' })
  plantilla: PlantillaNotificacionTraslado | string;

  @Column({ type: 'varchar', length: 20 })
  ambito: AmbitoNotificacionTraslado;

  @Column({ length: 200, default: '' })
  destinatario: string;

  @Column({ type: 'varchar', length: 20, default: 'usuario' })
  destinatarioTipo: string;

  @Column({ type: 'int', nullable: true })
  destinatarioUserId: number | null;

  @Column({ type: 'varchar', length: 120, default: '' })
  destinatarioEmail: string;

  @Column({ type: 'int', nullable: true })
  destinatarioInstitutionId: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  destinatarioAmbitoNivel: string | null;

  @Column({ type: 'varchar', length: 30, default: '' })
  destinatarioRol: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estadoAnterior: string | null;

  @Column({ type: 'varchar', length: 20, default: '' })
  estadoNuevo: string;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estadoEntrega: EstadoEntregaNotificacion;

  @Column({ type: 'varchar', length: 20, nullable: true })
  canalEntrega: CanalEntregaNotificacion | null;

  @Column({ default: false })
  correoSimulado: boolean;

  @Column({ type: 'varchar', length: 120, default: '' })
  correoMessageId: string;

  @Column({ default: 0 })
  intentos: number;

  @Column({ default: 3 })
  maxIntentos: number;

  @Column({ type: 'text', default: '' })
  ultimoError: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  idempotencyKey: string | null;

  @Column({ default: false })
  leida: boolean;

  @Column({ type: 'timestamp', nullable: true })
  entregadoAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  leidoAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
