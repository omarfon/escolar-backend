import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('horario_periodos')
@Index(['anioEscolar', 'orden'], { unique: true })
export class HorarioPeriodo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'int' })
  orden: number;

  @Column({ length: 40 })
  nombre: string;

  @Column({ length: 5 })
  horaInicio: string;

  @Column({ length: 5 })
  horaFin: string;

  @Column({ default: false })
  esReceso: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  niveles: string[];

  @Column({ default: true })
  activo: boolean;
}
