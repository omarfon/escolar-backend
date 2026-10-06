import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('salones')
@Index(['institutionId', 'anioEscolar', 'nivel', 'grado', 'seccion'], { unique: true })
export class Salon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ length: 40 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 10 })
  seccion: string;

  @Column({ type: 'int', default: 30 })
  aforo: number;

  @Column({ default: true })
  activo: boolean;
}
