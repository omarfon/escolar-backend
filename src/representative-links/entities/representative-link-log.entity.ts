import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type RepresentativeLinkAccion = 'crear' | 'actualizar' | 'cesar';

@Entity('representative_link_logs')
export class RepresentativeLinkLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  linkId: number | null;

  @Column({ type: 'int' })
  representativeId: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 20 })
  accion: RepresentativeLinkAccion;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb', default: {} })
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ length: 10, default: 'success' })
  resultado: string;

  @CreateDateColumn()
  createdAt: Date;
}
