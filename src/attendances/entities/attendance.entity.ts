import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendances')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ length: 1 })
  estado: 'P' | 'F' | 'T' | 'J';

  @Column({ nullable: true })
  observacion?: string;
}
