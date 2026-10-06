import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type NivelLogroDiagnostico = 'AD' | 'A' | 'B' | 'C';

@Entity('diagnostic_evaluations')
@Unique('UQ_diag_eval_student_curso_anio', ['studentId', 'curso', 'anio'])
export class DiagnosticEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ length: 120 })
  curso: string;

  @Column({ type: 'int', default: 1 })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'float', nullable: true })
  nota: number | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  nivelLogro: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ type: 'int', nullable: true })
  registradoPor?: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
