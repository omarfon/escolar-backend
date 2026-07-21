import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_capacidades')
export class CurriculumCapacidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  competenciaId: number;

  @Column({ length: 300 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
