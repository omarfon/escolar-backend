import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ length: 120 })
  titulo: string;

  @Column({ length: 120 })
  curso: string;

  @Column({ type: 'date' })
  fechaEntrega: string;

  @Column({ length: 20, default: 'PENDING' })
  estado: 'PENDING' | 'SUBMITTED' | 'OVERDUE';

  @Column({ length: 10, default: 'media' })
  prioridad: 'alta' | 'media' | 'baja';
}
