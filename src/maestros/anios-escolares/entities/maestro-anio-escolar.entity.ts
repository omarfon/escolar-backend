import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EstadoAnioEscolar, TipoPeriodoAnioEscolar } from '../anio-escolar.constants';

@Entity('maestros_anios_escolares')
@Index(['institutionId', 'anio'], { unique: true })
export class MaestroAnioEscolar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  institutionId: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date' })
  fechaFin: string;

  @Column({ type: 'varchar', length: 20, default: 'bimestre' })
  tipoPeriodo: TipoPeriodoAnioEscolar;

  @Column({ type: 'varchar', length: 20, default: 'planificado' })
  estado: EstadoAnioEscolar;

  @Column({ default: false })
  vigente: boolean;

  @Column({ default: 1 })
  version: number;

  @Column({ default: false })
  publicado: boolean;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
