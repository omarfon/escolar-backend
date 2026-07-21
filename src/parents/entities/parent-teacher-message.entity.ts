import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('parent_teacher_messages')
export class ParentTeacherMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  parentEmail: string;

  @Column({ length: 120 })
  parentNombre: string;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 160 })
  studentNombre: string;

  @Column({ type: 'int' })
  docenteId: number;

  @Column({ length: 160 })
  docenteNombre: string;

  @Column({ length: 120 })
  docenteEmail: string;

  @Column({ length: 200 })
  asunto: string;

  @Column({ type: 'text' })
  cuerpo: string;

  @Column({ length: 20, default: 'enviado' })
  estado: 'enviado' | 'error';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
