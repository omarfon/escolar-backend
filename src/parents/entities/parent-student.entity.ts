import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('parent_students')
export class ParentStudent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  parentEmail: string;

  @Column()
  studentId: number;

  @Column({ length: 30, default: 'apoderado' })
  parentesco: string;
}
