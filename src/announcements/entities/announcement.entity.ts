import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ length: 120 })
  titulo: string;

  @Column({ type: 'text' })
  cuerpo: string;

  @Column({ length: 20, default: 'general' })
  tipo: 'general' | 'academico' | 'administrativo' | 'urgente' | 'evento';

  @Column({ length: 20, default: 'alumnos' })
  destinatarios: 'alumnos' | 'padres' | 'todos' | 'docentes';

  @Column({ length: 10, default: 'media' })
  prioridad: 'alta' | 'media' | 'baja';

  @Column({ type: 'date' })
  fechaPublicacion: string;

  @Column({ type: 'date', nullable: true })
  fechaVencimiento?: string;

  @Column({ default: true })
  habilitado: boolean;
}
