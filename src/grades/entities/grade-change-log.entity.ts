import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GradeChangeAccion =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'registro_masivo'
  | 'rectificar';

export type GradeChangeResultado = 'success' | 'error';

@Entity('grade_change_logs')
@Index('idx_grade_change_student_created', ['studentId', 'createdAt'])
@Index('idx_grade_change_grade_created', ['gradeId', 'createdAt'])
@Index('idx_grade_change_correlation', ['correlationId'])
export class GradeChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  gradeId: number | null;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20, default: '' })
  studentCodigo: string;

  @Column({ length: 160, default: '' })
  studentNombre: string;

  @Column({ length: 120, default: '' })
  curso: string;

  @Column({ length: 40, default: '' })
  componenteCodigo: string;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ length: 40, default: '' })
  nivel: string;

  @Column({ length: 20, default: '' })
  grado: string;

  @Column({ length: 10, default: '' })
  seccion: string;

  @Column({ length: 20 })
  accion: GradeChangeAccion;

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
  resultado: GradeChangeResultado;

  @CreateDateColumn()
  createdAt: Date;
}
