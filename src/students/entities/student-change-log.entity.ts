import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StudentChangeAccion =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'cambio_seccion'
  | 'retiro'
  | 'reingreso';

export type StudentChangeResultado = 'success' | 'error';

@Entity('student_change_logs')
@Index('idx_student_change_student_created', ['studentId', 'createdAt'])
@Index('idx_student_change_correlation', ['correlationId'])
export class StudentChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20, default: '' })
  studentCodigo: string;

  @Column({ length: 160, default: '' })
  studentNombre: string;

  @Column({ length: 20 })
  accion: StudentChangeAccion;

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
  resultado: StudentChangeResultado;

  @CreateDateColumn()
  createdAt: Date;
}
