import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('horario_blocks')
@Index(
  ['anioEscolar', 'nivel', 'grado', 'seccion', 'dia', 'periodoId'],
  { unique: true },
)
export class HorarioBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 10 })
  seccion: string;

  /** 0 = Lunes … 4 = Viernes */
  @Column({ type: 'smallint' })
  dia: number;

  @Column({ type: 'int' })
  periodoId: number;

  /** curriculum_subject.id */
  @Column({ type: 'int' })
  cursoId: number;

  /** users.id (DOCENTE) */
  @Column({ type: 'int' })
  docenteId: number;

  @Column({ default: true })
  activo: boolean;
}
