import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type CompetencyChangeAccion = 'crear' | 'actualizar' | 'eliminar';

@Entity('competency_change_logs')
@Index(['studentId', 'createdAt'])
@Index(['evaluationId', 'createdAt'])
export class CompetencyChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  evaluationId: number | null;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'int' })
  competenciaId: number;

  @Column({ type: 'int' })
  curriculumId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 20 })
  accion: CompetencyChangeAccion;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb' })
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ length: 10, default: 'success' })
  resultado: 'success' | 'error';

  @CreateDateColumn()
  createdAt: Date;
}
