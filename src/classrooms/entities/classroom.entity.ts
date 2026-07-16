import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('classrooms')
@Index(['anioEscolar', 'nivel', 'grado', 'seccion'], { unique: true })
export class Classroom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ length: 40 })
  nivel: string;

  /** Formato matricula: 1°, 2°, etc. */
  @Column({ length: 20 })
  grado: string;

  @Column({ length: 10 })
  seccion: string;

  @Column({ type: 'int', default: 30 })
  aforo: number;

  @Column({ default: true })
  activo: boolean;
}
