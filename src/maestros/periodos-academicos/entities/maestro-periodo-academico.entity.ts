import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MaestroPeriodoTipo = 'bimestre' | 'trimestre' | 'semestre';

export type MaestroPeriodoEstado = 'pendiente' | 'en_curso' | 'cerrado';

@Entity('maestros_periodos_academicos')
@Index(['anioEscolar', 'numero'], { unique: true })
export class MaestroPeriodoAcademico {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'int' })
  numero: number;

  @Column({ length: 80 })
  nombre: string;

  @Column({ length: 20, default: 'bimestre' })
  tipo: MaestroPeriodoTipo;

  @Column({ type: 'date' })
  inicio: string;

  @Column({ type: 'date' })
  fin: string;

  @Column({ default: false })
  actual: boolean;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ default: true })
  activo: boolean;
}
