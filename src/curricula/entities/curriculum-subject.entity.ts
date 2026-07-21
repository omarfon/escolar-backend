import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_subjects')
export class CurriculumSubject {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  curriculumId: number | null;

  @Column({ type: 'int', nullable: true })
  maestroCursoId: number | null;

  @Column({ length: 120 })
  nombre: string;

  @Column()
  areaId: number;

  @Column({ length: 20 })
  nivel: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  grados: string[];

  @Column({ type: 'int', default: 0 })
  horasSemanales: number;

  @Column({ default: true })
  activo: boolean;
}
