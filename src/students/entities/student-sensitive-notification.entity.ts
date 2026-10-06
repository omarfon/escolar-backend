import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('student_sensitive_notifications')
@Index(['studentId', 'createdAt'])
export class StudentSensitiveNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  studentChangeLogId: number | null;

  @Column()
  studentId: number;

  @Column({ length: 160, default: '' })
  studentNombre: string;

  @Column({ length: 20, default: '' })
  studentCodigo: string;

  /** Nombres de campos sensibles modificados (sin valores completos). */
  @Column({ type: 'jsonb', default: [] })
  camposNotificados: string[];

  @Column({ length: 120, default: '' })
  correoDestino: string;

  @Column({ default: false })
  correoEnviado: boolean;

  @Column({ length: 20, default: 'email' })
  canal: string;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ length: 45, default: '' })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
