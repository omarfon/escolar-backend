import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface FormulaComponente {
  codigo: string;
  nombre: string;
  peso: number;
  orden: number;
  activo?: boolean;
}

export interface FormulaEscalaLogro {
  AD: number;
  A: number;
  B: number;
}

@Entity('maestros_formulas_evaluacion')
export class MaestroFormulaEvaluacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 40, default: '' })
  codigo: string;

  @Column({ length: 40, default: '' })
  nivel: string;

  @Column({ length: 40, default: '' })
  grado: string;

  @Column({ length: 120, default: '' })
  curso: string;

  @Column({ type: 'int', nullable: true })
  bimestre: number | null;

  @Column({ type: 'jsonb', default: [] })
  componentes: FormulaComponente[];

  @Column({
    type: 'jsonb',
    default: () => `'{"AD":17.5,"A":14,"B":11}'`,
  })
  escalaLogro: FormulaEscalaLogro;

  @Column({ default: false })
  esDefault: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ default: true })
  activo: boolean;
}
