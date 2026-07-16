import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WaitlistPrioridad = 'alta' | 'media' | 'baja';
export type WaitlistEstado = 'en_espera' | 'notificado' | 'asignado' | 'cancelado';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  nombres: string;

  @Column({ length: 80 })
  apellidos: string;

  @Column({ length: 8 })
  dni: string;

  @Column({ length: 120, default: '' })
  email: string;

  @Column({ length: 30, default: '' })
  telefono: string;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5, default: '' })
  seccionDeseada: string;

  @Column({ length: 10, default: 'media' })
  prioridad: WaitlistPrioridad;

  @Column({ length: 15, default: 'en_espera' })
  estado: WaitlistEstado;

  @Column({ length: 300, default: '' })
  observacion: string;

  @Column({ type: 'int', nullable: true })
  studentId: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaSolicitud: Date;

  @Column({ type: 'timestamp', nullable: true })
  notificadoAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  asignadoAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
