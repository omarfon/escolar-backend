import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CanalRetroalimentacion } from '../enrollment-feedback.constants';

export type EnrollmentFeedbackEstado = 'registrado';

@Entity('enrollment_feedbacks')
@Index('idx_enrollment_feedback_eval', ['enrollmentEvaluationId'], {
  unique: true,
})
@Index('idx_enrollment_feedback_correlation', ['correlationId'])
export class EnrollmentFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'int' })
  enrollmentEvaluationId: number;

  @Column({ type: 'int', nullable: true })
  waitlistEntryId: number | null;

  @Column({ type: 'int', nullable: true })
  studentId: number | null;

  @Column({ length: 160, default: '' })
  candidatoNombre: string;

  @Column({ length: 20, default: '' })
  candidatoDni: string;

  @Column({ length: 80, default: '' })
  tipoEvaluacion: string;

  @Column({ length: 30, default: '' })
  resultadoEvaluacion: string;

  @Column({ type: 'varchar', length: 40 })
  canal: CanalRetroalimentacion;

  @Column({ type: 'date' })
  fechaRetroalimentacion: string;

  @Column({ length: 120, default: '' })
  destinatario: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'boolean', default: false })
  acuseRecibo: boolean;

  @Column({ type: 'varchar', length: 20, default: 'registrado' })
  estado: EnrollmentFeedbackEstado;

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
