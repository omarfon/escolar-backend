import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ConceptTipo = 'obligatorio' | 'voluntario' | 'eventual';
export type ConceptPeriodicidad = 'mensual' | 'bimestral' | 'anual' | 'unico';

@Entity('payment_concepts')
export class PaymentConcept {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, unique: true })
  codigo: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ length: 20, default: 'obligatorio' })
  tipo: ConceptTipo;

  @Column({ length: 20, default: 'mensual' })
  periodicidad: ConceptPeriodicidad;

  @Column({ length: 20, default: 'Todos' })
  nivel: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
