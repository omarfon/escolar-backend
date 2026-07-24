import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PromedioTipo = 'numerico' | 'competencia';
export type PromedioNivelLogro = 'AD' | 'A' | 'B' | 'C';

@Entity('promedios')
@Index(['studentId', 'curso', 'tipo', 'bimestre', 'anio'], { unique: true })
export class Promedio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ length: 120 })
  curso: string;

  @Column({ length: 20, default: 'numerico' })
  tipo: PromedioTipo;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'float', nullable: true })
  valorNumerico: number | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  nivelLogro: PromedioNivelLogro | null;
}
