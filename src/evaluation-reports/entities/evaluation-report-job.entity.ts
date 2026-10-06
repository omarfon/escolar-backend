import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluation_report_jobs')
export class EvaluationReportJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  institutionId: number;

  @Column({ type: 'varchar', length: 128, default: '' })
  scopeKey: string;

  @Column({ type: 'varchar', length: 32 })
  reportType: string;

  @Column({ type: 'varchar', length: 8 })
  format: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  filtros: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  totalFilas: number;

  @Column({ length: 512, nullable: true })
  archivoPath?: string;

  @Column({ length: 255, nullable: true })
  archivoNombre?: string;

  @Column({ type: 'text', nullable: true })
  errorMensaje?: string;

  @Column({ type: 'int', nullable: true })
  solicitadoPor?: number;

  @Column({ length: 120, nullable: true })
  solicitadoPorNombre?: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;
}
