import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EducationLevel } from './education-level.entity';
import { GradeSection } from './grade-section.entity';

@Entity('grade_levels')
export class GradeLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nivelId: number;

  @ManyToOne(() => EducationLevel, (nivel) => nivel.grados, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nivelId' })
  nivel: EducationLevel;

  @Column({ length: 80 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @OneToMany(() => GradeSection, (seccion) => seccion.grado, { cascade: true })
  secciones: GradeSection[];
}
