import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DiagnosticChangeAccion = 'crear' | 'actualizar' | 'registro_masivo';

@Entity('diagnostic_change_logs')
export class DiagnosticChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  evaluationId: number | null;

  @Column()
  studentId: number;

  @Column({ length: 120 })
  curso: string;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 20 })
  accion: DiagnosticChangeAccion;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb', default: {} })
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ length: 10, default: 'success' })
  resultado: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
