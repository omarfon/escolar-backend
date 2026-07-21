import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EventoTipo =
  | 'academico'
  | 'deportivo'
  | 'cultural'
  | 'reunion'
  | 'feriado'
  | 'otro';

export type EventoDestinatario =
  | 'alumnos'
  | 'padres'
  | 'todos'
  | 'docentes'
  | 'salon';

export type EventoVisibilidad = 'global' | 'limitado';

export type EventoEstado =
  | 'programado'
  | 'en_curso'
  | 'finalizado'
  | 'cancelado';

@Entity('eventos')
export class Evento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  titulo: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ length: 20, default: 'academico' })
  tipo: EventoTipo;

  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date', nullable: true })
  fechaFin: string | null;

  @Column({ length: 5, default: '08:00' })
  horaInicio: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  horaFin: string | null;

  @Column({ length: 120, default: '' })
  lugar: string;

  @Column({ length: 20, default: 'todos' })
  destinatarios: EventoDestinatario;

  /** global = toda la comunidad; limitado = audiencia acotada (destinatarios / salón). */
  @Column({ length: 20, default: 'global' })
  visibilidad: EventoVisibilidad;

  @Column({ length: 40, default: '' })
  nivel: string;

  @Column({ length: 20, default: '' })
  grado: string;

  @Column({ length: 10, default: '' })
  seccion: string;

  @Column({ length: 120, default: '' })
  responsable: string;

  @Column({ default: true })
  publicado: boolean;

  @Column({ default: false })
  cancelado: boolean;

  @Column({ length: 20, default: 'programado' })
  estado: EventoEstado;
}

/** Alias legacy */
export { Evento as SchoolEvent };
