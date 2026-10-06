import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EstadoTraslado } from '../transfer.constants';

@Entity('transfer_requests')
export class TransferRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, default: '' })
  codigo: string;

  @Column()
  studentId: number;

  @Column({ length: 20, default: '' })
  studentCodigo: string;

  @Column({ length: 180, default: '' })
  studentNombre: string;

  @Column({ length: 20, default: '' })
  studentDni: string;

  @Column()
  anioEscolar: number;

  @Column({ type: 'varchar', length: 20, default: 'borrador' })
  estado: EstadoTraslado;

  @Column({ length: 200, default: '' })
  ieOrigenNombre: string;

  @Column({ length: 20, default: '' })
  ieOrigenCodigoModular: string;

  @Column({ length: 80, default: '' })
  ieOrigenUgel: string;

  @Column({ length: 80, default: '' })
  ieOrigenDre: string;

  @Column({ type: 'int', nullable: true })
  ieOrigenInstitutionId: number | null;

  @Column({ length: 200 })
  ieDestinoNombre: string;

  @Column({ length: 20 })
  ieDestinoCodigoModular: string;

  @Column({ length: 80 })
  ieDestinoUgel: string;

  @Column({ length: 80 })
  ieDestinoDre: string;

  @Column({ type: 'int', nullable: true })
  ieDestinoInstitutionId: number | null;

  /** Sección asignada en la IE destino al aprobar el traslado. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  seccionDestino: string | null;

  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'text', default: '' })
  observacion: string;

  @Column({ type: 'date' })
  plazoHasta: string;

  @Column({ type: 'text' })
  evidencia: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  evidenciaTipo: string | null;

  @Column({ type: 'int', nullable: true })
  evidenciaDocumentId: number | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  evidenciaReferencia: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ length: 120, default: '' })
  actorNombre: string;

  @Column({ length: 60, default: '' })
  actorRol: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
