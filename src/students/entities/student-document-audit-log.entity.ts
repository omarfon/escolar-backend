import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StudentDocumentAuditAccion =
  | 'subir'
  | 'descargar'
  | 'actualizar_metadatos'
  | 'sync_requisitos';

@Entity('student_document_audit_logs')
export class StudentDocumentAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'int', nullable: true })
  documentId: number | null;

  @Column({ type: 'int', nullable: true })
  versionId: number | null;

  @Column({ length: 30 })
  accion: StudentDocumentAuditAccion;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'jsonb', default: {} })
  detalle: Record<string, unknown>;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ length: 10, default: 'success' })
  resultado: string;

  @CreateDateColumn()
  createdAt: Date;
}
