import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ChargeEstado = 'pendiente' | 'parcial' | 'pagado' | 'vencido';

@Entity('student_charges')
export class StudentCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column()
  conceptId: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ length: 80 })
  periodoLabel: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoPagado: number;

  @Column({ type: 'date' })
  fechaVencimiento: string;

  @Column({ length: 20, default: 'pendiente' })
  estado: ChargeEstado;
}
