import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CurriculumEstado = 'activo' | 'inactivo' | 'borrador';
export type CurriculumTipoEscala = 'numerica' | 'literal' | 'competencia';
export type CurriculumTipoPeriodo = 'bimestral' | 'trimestral';

@Entity('curricula')
@Index(['institutionId', 'anio', 'nivel'])
export class Curriculum {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 15, default: 'borrador' })
  estado: CurriculumEstado;

  @Column({ length: 10, default: '1.0' })
  version: string;

  @Column({ length: 20, default: 'numerica' })
  tipoEscala: CurriculumTipoEscala;

  @Column({ length: 20, default: 'bimestral' })
  tipoPeriodo: CurriculumTipoPeriodo;

  @Column({ type: 'date' })
  fechaCreacion: string;
}
