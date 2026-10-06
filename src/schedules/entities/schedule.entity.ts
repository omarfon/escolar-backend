import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column()
  studentId: number;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ type: 'int' })
  dia: number;

  @Column({ length: 5 })
  horaInicio: string;

  @Column({ length: 5 })
  horaFin: string;

  @Column({ length: 120 })
  curso: string;

  @Column({ length: 80 })
  docente: string;
}
