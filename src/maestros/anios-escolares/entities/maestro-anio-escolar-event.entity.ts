import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('maestros_anio_escolar_eventos')
export class MaestroAnioEscolarEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  anioEscolarId: number;

  @Column({ length: 30 })
  accion: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estadoAnterior: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estadoNuevo: string | null;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb', default: {} })
  cambios: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @CreateDateColumn()
  createdAt: Date;
}
