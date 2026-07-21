import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ResourceTipo =
  | 'tarea'
  | 'clase'
  | 'lectura'
  | 'video'
  | 'enlace'
  | 'evaluacion'
  | 'imagen'
  | 'documento'
  | 'excel'
  | 'ppt';

@Entity('teacher_resources')
export class TeacherResource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  titulo: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ length: 20, default: 'clase' })
  tipo: ResourceTipo;

  @Column({ type: 'int', nullable: true })
  courseId: number | null;

  @Column({ length: 120 })
  curso: string;

  @Column({ length: 40 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ length: 120, default: '' })
  docente: string;

  @Column({ type: 'date' })
  fechaPublicacion: string;

  @Column({ type: 'date', nullable: true })
  fechaEntrega: string | null;

  @Column({ length: 500, default: '' })
  url: string;

  @Column({ length: 200, default: '' })
  nombreArchivo: string;

  @Column({ length: 120, default: '' })
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  tamanoBytes: number;

  @Column({ default: true })
  visible: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
