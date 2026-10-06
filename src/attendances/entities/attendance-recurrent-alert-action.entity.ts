import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type RecurrentAlertAccion =
  | 'detectada'
  | 'atender'
  | 'derivar'
  | 'cerrar'
  | 'justificar'
  | 'actualizar';

@Entity('attendance_recurrent_alert_actions')
@Index(['alertId', 'createdAt'])
export class AttendanceRecurrentAlertAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  alertId: number;

  @Column({ length: 30 })
  accion: RecurrentAlertAccion;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb', nullable: true })
  valorAnterior: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  valorNuevo: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
