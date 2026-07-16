import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column({ length: 80, default: 'Sistema' })
  realizadoPor: string;

  @CreateDateColumn()
  createdAt: Date;
}
