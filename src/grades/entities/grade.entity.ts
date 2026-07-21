import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  courseId?: number;

  @Column({ length: 120 })
  curso: string;

  @Column({ length: 20 })
  tipo: 'daily' | 'partial' | 'final';

  @Column({ length: 40, default: '' })
  componenteCodigo: string;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'float' })
  nota: number;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ nullable: true })
  descripcion?: string;
}
