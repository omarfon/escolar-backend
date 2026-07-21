import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TaskEstado = 'PENDING' | 'SUBMITTED' | 'OVERDUE' | 'GRADED';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  resourceId: number | null;

  @Column({ length: 120 })
  titulo: string;

  @Column({ length: 120 })
  curso: string;

  @Column({ type: 'date' })
  fechaEntrega: string;

  @Column({ length: 20, default: 'PENDING' })
  estado: TaskEstado;

  @Column({ length: 10, default: 'media' })
  prioridad: 'alta' | 'media' | 'baja';

  @Column({ type: 'text', default: '' })
  comentarioEntrega: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  archivoEntregaUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  archivoEntregaNombre: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  archivoEntregaMime: string | null;

  @Column({ type: 'date', nullable: true })
  fechaEntregaReal: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  nota: number | null;

  @Column({ type: 'text', default: '' })
  retroalimentacion: string;

  @Column({ type: 'timestamp', nullable: true })
  calificadoAt: Date | null;
}
