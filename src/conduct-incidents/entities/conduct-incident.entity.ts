import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ConductIncidentTipo =
  | 'falta_leve'
  | 'falta_grave'
  | 'falta_muy_grave'
  | 'reconocimiento';

export type ConductIncidentEstado = 'pendiente' | 'en_proceso' | 'resuelto';

@Entity('conduct_incidents')
export class ConductIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20 })
  tipo: ConductIncidentTipo;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ length: 80, default: '' })
  lugar: string;

  @Column({ length: 120, default: '' })
  reportadoPor: string;

  @Column({ length: 15, default: 'pendiente' })
  estado: ConductIncidentEstado;

  @Column({ type: 'text', default: '' })
  medida: string;

  @Column({ default: false })
  notificadoPadre: boolean;

  @Column({ type: 'text', default: '' })
  observaciones: string;

  @CreateDateColumn()
  createdAt: Date;
}
