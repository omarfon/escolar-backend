import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GradeLevel } from './grade-level.entity';

@Entity('education_levels')
export class EducationLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  nombre: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @OneToMany(() => GradeLevel, (grado) => grado.nivel, { cascade: true })
  grados: GradeLevel[];
}
