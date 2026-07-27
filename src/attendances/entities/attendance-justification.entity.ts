import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { JustificacionAdjuntoMeta } from '../justifications-upload.util';

@Entity('attendance_justifications')
export class AttendanceJustification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ length: 120 })
  motivo: string;

  @Column({ type: 'text', default: '' })
  observacion: string;

  @Column({ type: 'simple-json' })
  attendanceIds: number[];

  @Column({ type: 'simple-json' })
  fechas: string[];

  @Column({ type: 'simple-json', default: '[]' })
  adjuntos: JustificacionAdjuntoMeta[];

  @Column({ length: 120, default: 'Administración' })
  registradoPor: string;

  @CreateDateColumn()
  createdAt: Date;
}
