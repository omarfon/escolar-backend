import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TemarioClaseEstado =
  | 'programada'
  | 'dictada'
  | 'reprogramada'
  | 'cancelada';

export type TemarioMaterialTipo =
  | 'texto'
  | 'documento'
  | 'enlace'
  | 'video';

@Entity('temario_clases')
export class TemarioClase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  docenteId: number;

  @Column({ length: 120 })
  docenteNombre: string;

  @Column({ type: 'int', nullable: true })
  assignmentId: number | null;

  @Column({ type: 'int' })
  cursoId: number;

  @Column({ length: 120 })
  cursoNombre: string;

  @Column({ length: 40 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ type: 'int' })
  anioEscolar: number;

  @Column({ type: 'int', default: 1 })
  numero: number;

  @Column({ length: 200 })
  titulo: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ type: 'text', default: '' })
  objetivos: string;

  /** Desarrollo de la clase: guion, explicaciones, actividades (texto extenso). */
  @Column({ type: 'text', default: '' })
  contenidoClase: string;

  /** JSON: [{ url, nombre, leyenda? }] */
  @Column({ type: 'text', default: '[]' })
  imagenesClase: string;

  @Column({ type: 'date' })
  fechaClase: string;

  @Column({ length: 20, default: 'programada' })
  estado: TemarioClaseEstado;

  /** Si false, el tema no se publicará para alumnos. */
  @Column({ default: true })
  visibleEstudiante: boolean;

  /** Fecha desde la cual el alumno puede ver el tema (null = inmediato si visible). */
  @Column({ type: 'date', nullable: true })
  fechaLiberacion: string | null;

  /** Hora de liberación (HH:mm) en la fecha indicada. */
  @Column({ length: 5, default: '08:00' })
  horaLiberacion: string;

  /** Días antes de la clase para liberar automáticamente (referencia UI). */
  @Column({ type: 'int', nullable: true })
  diasAntesLiberacion: number | null;

  @Column({ length: 150, default: '' })
  materialTitulo: string;

  @Column({ type: 'text', default: '' })
  materialDescripcion: string;

  @Column({ length: 20, default: 'texto' })
  materialTipo: TemarioMaterialTipo;

  @Column({ length: 500, default: '' })
  materialUrl: string;

  @Column({ length: 200, default: '' })
  materialNombreArchivo: string;

  @Column({ length: 120, default: '' })
  materialMimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
