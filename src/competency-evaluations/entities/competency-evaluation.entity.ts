import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type NivelLogro = 'AD' | 'A' | 'B' | 'C';

@Entity('competency_evaluations')
@Unique('UQ_comp_eval_student_comp_bim_anio', [
  'studentId',
  'competenciaId',
  'bimestre',
  'anio',
])
export class CompetencyEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column()
  competenciaId: number;

  @Column()
  curriculumId: number;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 2 })
  nivelLogro: NivelLogro;

  @Column({ type: 'text', nullable: true })
  observacion?: string;

  @Column({ type: 'int', nullable: true })
  registradoPor?: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
