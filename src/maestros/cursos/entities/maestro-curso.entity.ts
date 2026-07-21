import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('maestros_cursos')
export class MaestroCurso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 80 })
  area: string;

  @Column({ length: 20 })
  nivel: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  grados: string[];

  @Column({ type: 'int', default: 0 })
  horasSemanales: number;

  @Column({ default: true })
  activo: boolean;
}
