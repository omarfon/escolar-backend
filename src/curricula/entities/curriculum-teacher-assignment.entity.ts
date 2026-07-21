import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_teacher_assignments')
export class CurriculumTeacherAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  docenteId: number | null;

  @Column({ length: 120 })
  docenteNombre: string;

  @Column()
  cursoId: number;

  @Column({ type: 'int', nullable: true })
  curriculumId: number | null;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  secciones: string[];

  @Column({ type: 'int', default: 0 })
  horasSemanales: number;

  @Column({ default: true })
  activo: boolean;
}
