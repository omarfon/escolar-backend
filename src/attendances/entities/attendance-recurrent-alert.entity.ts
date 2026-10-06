import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RecurrentAlertEstado =
  | 'abierta'
  | 'atendida'
  | 'derivada'
  | 'cerrada';

export type RecurrentAlertPeriodoTipo = 'mes' | 'bimestre' | 'rolling30';

@Entity('attendance_recurrent_alerts')
@Index(['institutionId', 'estado', 'periodoKey'])
@Index(['studentId', 'periodoKey'])
export class AttendanceRecurrentAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20 })
  periodoKey: string;

  @Column({ length: 20, default: 'mes' })
  periodoTipo: RecurrentAlertPeriodoTipo;

  @Column({ length: 80, default: '' })
  periodoLabel: string;

  @Column({ length: 30, default: '' })
  nivelEducativo: string;

  @Column({ length: 20, default: 'todos' })
  modalidad: string;

  @Column({ length: 20, default: 'abierta' })
  estado: RecurrentAlertEstado;

  @Column({ length: 20, default: 'alerta' })
  nivelRiesgo: string;

  @Column({ type: 'int', default: 0 })
  faltasInjustificadas: number;

  @Column({ type: 'int', default: 0 })
  diasConsecutivos: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  porcentajeInasistencia: number;

  /** Indicadores observables; no es un diagnóstico clínico. */
  @Column({ type: 'text', default: '' })
  motivoObservacion: string;

  @Column({ length: 60, default: '' })
  derivadoARol: string;

  @Column({ length: 120, default: '' })
  derivadoAUsuario: string;

  @Column({ type: 'text', default: '' })
  cerradoMotivo: string;

  @Column({ type: 'int', nullable: true })
  justificationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;
}
