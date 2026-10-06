import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ResultadoEvaluacionMatricula,
  TipoEvaluacionMatricula,
} from '../enrollment-evaluation.constants';

export type EnrollmentEvaluationEstado = 'registrado';
export type EnrollmentEvaluationOrigen = 'waitlist' | 'estudiante';

@Entity('enrollment_evaluations')
@Index(
  'idx_enrollment_eval_waitlist_tipo_anio',
  ['waitlistEntryId', 'tipoEvaluacion', 'anioEscolar'],
  { unique: true, where: '"waitlistEntryId" IS NOT NULL' },
)
@Index(
  'idx_enrollment_eval_student_tipo_anio',
  ['studentId', 'tipoEvaluacion', 'anioEscolar'],
  { unique: true, where: '"studentId" IS NOT NULL' },
)
@Index('idx_enrollment_eval_correlation', ['correlationId'])
export class EnrollmentEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'varchar', length: 15 })
  origen: EnrollmentEvaluationOrigen;

  @Column({ type: 'int', nullable: true })
  waitlistEntryId: number | null;

  @Column({ type: 'int', nullable: true })
  studentId: number | null;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ length: 160, default: '' })
  candidatoNombre: string;

  @Column({ length: 20, default: '' })
  candidatoDni: string;

  @Column({ length: 20, default: '' })
  nivel: string;

  @Column({ length: 20, default: '' })
  grado: string;

  @Column({ length: 5, default: '' })
  seccionDeseada: string;

  @Column({ type: 'varchar', length: 80 })
  tipoEvaluacion: TipoEvaluacionMatricula;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ type: 'varchar', length: 30 })
  resultado: ResultadoEvaluacionMatricula;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  puntaje: number | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  observaciones: string;

  @Column({ type: 'text' })
  resolucion: string;

  @Column({ type: 'varchar', length: 20, default: 'registrado' })
  estado: EnrollmentEvaluationEstado;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
