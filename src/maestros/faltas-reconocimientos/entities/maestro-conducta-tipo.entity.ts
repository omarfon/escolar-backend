import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MaestroConductaDescripcion } from './maestro-conducta-descripcion.entity';

export type MaestroConductaCategoria = 'falta' | 'reconocimiento';

@Entity('maestros_conducta_tipos')
export class MaestroConductaTipo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40, unique: true })
  codigo: string;

  @Column({ length: 80 })
  nombre: string;

  @Column({ length: 20 })
  categoria: MaestroConductaCategoria;

  @Column({ length: 40, default: 'description' })
  icon: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => MaestroConductaDescripcion, (d) => d.tipo)
  descripciones: MaestroConductaDescripcion[];
}
