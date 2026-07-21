import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('student_payments')
export class StudentPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chargeId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ type: 'date' })
  fechaPago: string;

  @Column({ length: 30, default: 'transferencia' })
  metodoPago: string;

  @Column({ length: 80, default: '' })
  referencia: string;

  @Column({ length: 20, default: '' })
  numeroBoleta: string;

  @Column({ length: 20, default: '' })
  tarjetaMarca: string;

  @Column({ length: 4, default: '' })
  tarjetaUltimos4: string;

  @Column({ length: 120, default: '' })
  registradoPor: string;
}
