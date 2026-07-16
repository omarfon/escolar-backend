import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ActaEstado = 'borrador' | 'generada' | 'aprobada' | 'cerrada';

export interface ActaAlumnoRow {
  studentId: number;
  estudiante: string;
  notas: Record<string, number | null>;
  promedio: number | null;
  nivel: string | null;
  situacion: 'aprobado' | 'desaprobado' | 'sin_notas';
}

export interface ActaSnapshot {
  cursos: string[];
  alumnos: ActaAlumnoRow[];
  resumen: {
    total: number;
    aprobados: number;
    desaprobados: number;
    promedioAula: number | null;
  };
}

@Entity('evaluation_actas')
export class EvaluationActa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ type: 'int' })
  bimestre: number;

  @Column({ length: 4, default: '2026' })
  anio: string;

  @Column({ length: 20, default: 'generada' })
  estado: ActaEstado;

  @Column({ length: 120, default: '' })
  docente: string;

  @Column({ length: 120, default: '' })
  aprobadoPor: string;

  @Column({ type: 'text', default: '' })
  observaciones: string;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: ActaSnapshot | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;
}
