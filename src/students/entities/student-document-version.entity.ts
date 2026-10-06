import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('student_document_versions')
@Index(['documentId', 'activo'])
export class StudentDocumentVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  documentId: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'int' })
  version: number;

  @Column({ length: 255 })
  nombreArchivo: string;

  @Column({ length: 120 })
  mimeType: string;

  @Column({ type: 'int' })
  tamanoBytes: number;

  @Column({ length: 64 })
  sha256: string;

  @Column({ type: 'text' })
  storagePath: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'date', nullable: true })
  vigenciaHasta: string | null;

  @Column({ type: 'int', nullable: true })
  uploadedByUserId: number | null;

  @Column({ length: 120, default: '' })
  uploadedByNombre: string;

  @CreateDateColumn()
  createdAt: Date;
}
