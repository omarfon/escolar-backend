import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAccion =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'login'
  | 'logout'
  | 'exportar'
  | 'aprobar'
  | 'rechazar'
  | 'publicar'
  | 'configurar'
  | 'consultar';

export type AuditNivel = 'info' | 'warning' | 'critical';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ length: 120, default: '' })
  usuarioNombre: string;

  @Column({ length: 60, default: '' })
  usuarioRol: string;

  @Column({ length: 20, default: 'consultar' })
  accion: AuditAccion;

  @Column({ length: 60, default: '' })
  modulo: string;

  @Column({ length: 80, default: '' })
  entidad: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  entidadId: string | null;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ type: 'jsonb', nullable: true })
  detalle: Record<string, unknown> | null;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ length: 10, default: 'info' })
  nivel: AuditNivel;

  @CreateDateColumn()
  createdAt: Date;
}
