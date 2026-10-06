import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('student_academic_history')
export class StudentAcademicHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 4 })
  anio: string;

  @Column({ length: 40 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ type: 'float', default: 0 })
  promedio: number;

  @Column({ length: 30, default: 'Promovido' })
  estado: string;

  /** IE de ese año. Puede ser distinta a la de otros años del mismo alumno. */
  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  /** Código modular de la IE en ese año. */
  @Column({ length: 20, default: '' })
  codigoInstitucion: string;
}
