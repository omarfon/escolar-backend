import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StudentWithdrawalEstado = 'registrado';

@Entity('student_withdrawals')
@Index('idx_student_withdrawal_student_anio', ['studentId', 'anioEscolar'], {
  unique: true,
})
@Index('idx_student_withdrawal_correlation', ['correlationId'])
export class StudentWithdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20, default: '' })
  studentCodigo: string;

  @Column({ length: 160, default: '' })
  studentNombre: string;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ length: 20, default: '' })
  nivel: string;

  @Column({ length: 20, default: '' })
  grado: string;

  @Column({ length: 5, default: '' })
  seccion: string;

  @Column({ type: 'date' })
  fechaRetiro: string;

  @Column({ length: 80 })
  motivo: string;

  @Column({ type: 'text' })
  sustento: string;

  @Column({ length: 20, default: 'registrado' })
  estado: StudentWithdrawalEstado;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ type: 'int', default: 0 })
  notasConservadas: number;

  @Column({ type: 'int', default: 0 })
  asistenciasConservadas: number;

  @Column({ type: 'int', default: 0 })
  vacantesDisponiblesDespues: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
