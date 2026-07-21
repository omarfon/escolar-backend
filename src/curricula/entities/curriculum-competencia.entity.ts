import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_competencias')
export class CurriculumCompetencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cursoId: number;

  @Column({ length: 300 })
  nombre: string;

  @Column({ default: true })
  activo: boolean;
}
