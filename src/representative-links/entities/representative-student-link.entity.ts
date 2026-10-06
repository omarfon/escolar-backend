import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('representative_student_links')
@Index(['representativeId', 'studentId'], {
  unique: true,
  where: '"activo" = true',
})
export class RepresentativeStudentLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  representativeId: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 30, default: 'apoderado' })
  tipoVinculo: string;

  @Column({ default: false })
  esPrincipal: boolean;

  @Column({ type: 'date' })
  vigenciaDesde: string;

  @Column({ type: 'date', nullable: true })
  vigenciaHasta: string | null;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', default: '' })
  motivoCese: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
