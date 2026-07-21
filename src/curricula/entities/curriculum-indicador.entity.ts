import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_indicadores')
export class CurriculumIndicador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  capacidadId: number;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'int', default: 0 })
  ponderacion: number;

  @Column({ default: true })
  activo: boolean;
}
