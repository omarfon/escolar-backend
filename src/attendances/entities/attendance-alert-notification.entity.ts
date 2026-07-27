import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('attendance_alert_notifications')
@Index(['studentId', 'mes'], { unique: true })
export class AttendanceAlertNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  /** Periodo YYYY-MM de la alerta de ausentismo. */
  @Column({ length: 7 })
  mes: string;

  @Column({ length: 120, default: 'Administración' })
  notificadoPor: string;

  @Column({ length: 40, default: '' })
  mesLabel: string;

  @Column({ type: 'int', default: 0 })
  faltasInjustificadas: number;

  @Column({ type: 'int', default: 0 })
  diasConsecutivos: number;

  @Column({ length: 20, default: 'alerta' })
  nivelAlerta: string;

  @Column({ type: 'text', default: '' })
  motivoAlerta: string;

  @Column({ default: false })
  correoEnviado: boolean;

  @Column({ length: 120, default: '' })
  correoDestino: string;

  @Column({ default: false })
  leidoEnPortal: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  notificadoAt: Date;
}
