import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ContinuitySituacion =
  | 'promovido'
  | 'repitente'
  | 'retirado'
  | 'egresado';

export type ContinuityEstado = 'pendiente' | 'aprobado' | 'rechazado';

@Entity('continuity_enrollments')
export class ContinuityEnrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'int' })
  anioAnterior: number;

  @Column({ type: 'int' })
  anioNuevo: number;

  @Column({ length: 40 })
  gradoAnterior: string;

  @Column({ length: 5 })
  seccionAnterior: string;

  @Column({ length: 40 })
  gradoNuevo: string;

  @Column({ length: 5 })
  seccionNueva: string;

  @Column({ type: 'float', default: 0 })
  promedioFinal: number;

  @Column({ length: 20 })
  situacion: ContinuitySituacion;

  @Column({ length: 20, default: 'pendiente' })
  estado: ContinuityEstado;

  @Column({ length: 80, default: 'Administrador' })
  generadoPor: string;

  @CreateDateColumn()
  fechaGeneracion: Date;

  @Column({ length: 80, nullable: true, type: 'varchar' })
  aprobadoPor: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fechaAprobacion: Date | null;

  @Column({ type: 'text', default: '' })
  motivoRechazo: string;
}
