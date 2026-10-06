import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type ReportCardEstado = 'pendiente' | 'generada' | 'firmada';

@Entity('report_cards')
@Unique('UQ_report_card_student_bim_anio', ['studentId', 'bimestre', 'anio'])
export class ReportCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  studentId: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 20, default: 'pendiente' })
  estado: ReportCardEstado;

  @Column({ type: 'text', default: '' })
  observaciones: string;

  @Column({ length: 120, default: '' })
  firmaDirectorNombre: string;

  @Column({ length: 80, default: 'Director(a)' })
  firmaDirectorCargo: string;

  @Column({ default: false })
  firmaDirectorFirmado: boolean;

  @Column({ length: 20, default: '' })
  firmaDirectorFecha: string;

  @Column({ length: 120, default: '' })
  firmaTutorNombre: string;

  @Column({ length: 80, default: 'Docente Tutor(a)' })
  firmaTutorCargo: string;

  @Column({ default: false })
  firmaTutorFirmado: boolean;

  @Column({ length: 20, default: '' })
  firmaTutorFecha: string;

  @Column({ type: 'timestamptz', nullable: true })
  generadaAt?: Date;
}
