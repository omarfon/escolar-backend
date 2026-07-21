import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MaestroConductaTipo } from './maestro-conducta-tipo.entity';

@Entity('maestros_conducta_descripciones')
export class MaestroConductaDescripcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  tipoId: number;

  @ManyToOne(() => MaestroConductaTipo, (t) => t.descripciones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tipoId' })
  tipo: MaestroConductaTipo;

  @Column({ type: 'text' })
  texto: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
