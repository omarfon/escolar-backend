import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MaestroFeriadoTipo = 'nacional' | 'local' | 'institucional';

@Entity('maestros_feriados')
@Index(['anioEscolar', 'fecha'], { unique: true })
export class MaestroFeriado {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 20, default: 'nacional' })
  tipo: MaestroFeriadoTipo;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ default: true })
  activo: boolean;
}
