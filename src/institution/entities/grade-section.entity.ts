import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GradeLevel } from './grade-level.entity';

@Entity('grade_sections')
export class GradeSection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gradoId: number;

  @ManyToOne(() => GradeLevel, (grado) => grado.secciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gradoId' })
  grado: GradeLevel;

  @Column({ length: 40 })
  nombre: string;
}
