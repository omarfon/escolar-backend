import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SectionChangeEstado = 'completado';

@Entity('section_changes')
export class SectionChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ length: 120 })
  estudiante: string;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccionAnterior: string;

  @Column({ length: 5 })
  seccionNueva: string;

  @Column({ length: 80, default: '' })
  motivo: string;

  @Column({ length: 300, default: '' })
  observacion: string;

  @Column({ length: 120, default: '' })
  autorizadoPor: string;

  @Column({ length: 80, default: 'Sistema' })
  realizadoPor: string;

  @Column({ type: 'int', nullable: true })
  anioEscolar: number | null;

  @Column({ length: 15, default: 'completado' })
  estado: SectionChangeEstado;

  @CreateDateColumn()
  createdAt: Date;
}
