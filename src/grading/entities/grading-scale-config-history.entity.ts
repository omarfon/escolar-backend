import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GradingScaleHistoryAlcance = 'institucion' | 'curriculum';

@Entity('grading_scale_config_history')
@Index(['institutionId', 'createdAt'])
export class GradingScaleConfigHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column({ length: 30 })
  alcance: GradingScaleHistoryAlcance;

  @Column({ type: 'int', nullable: true })
  curriculumId: number | null;

  @Column({ length: 30, default: '' })
  nivel: string;

  @Column({ length: 30, default: 'actualizar' })
  accion: string;

  @Column({ type: 'jsonb', nullable: true })
  valorAnterior: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  valorNuevo: Record<string, unknown>;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @CreateDateColumn()
  createdAt: Date;
}
