import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type StudentSexo = 'M' | 'F';
export type StudentEstadoMatricula = 'activo' | 'inactivo' | 'retirado';
/** elegible: pendiente de cambio | cambio_realizado: ya fue trasladado en el periodo */
export type EstadoCambioSeccion = 'elegible' | 'cambio_realizado';

export interface RepresentanteData {
  nombres: string;
  apellidos: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  dni: string;
  telefono: string;
  email: string;
  trabajo: string;
}

export const REPRESENTANTE_VACIO: RepresentanteData = {
  nombres: '',
  apellidos: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  tipoDocumento: 'DNI',
  dni: '',
  telefono: '',
  email: '',
  trabajo: '',
};

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  nombre: string;

  @Column({ length: 80 })
  apellido: string;

  @Column({ length: 80, default: '' })
  apellidoPaterno: string;

  @Column({ length: 80, default: '' })
  apellidoMaterno: string;

  @Column({ unique: true, length: 120 })
  email: string;

  @Column({ length: 20 })
  nivel: string;

  @Column({ length: 20 })
  grado: string;

  @Column({ length: 5 })
  seccion: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ length: 20, default: '' })
  codigo: string;

  @Column({ length: 20, default: '' })
  dni: string;

  @Column({ length: 15, default: 'DNI' })
  tipoDocumento: string;

  @Column({ type: 'date', nullable: true })
  fechaNac: string | null;

  @Column({ type: 'varchar', length: 1, default: 'M' })
  sexo: StudentSexo;

  @Column({ type: 'text', default: '' })
  direccion: string;

  @Column({ length: 80, default: '' })
  distrito: string;

  @Column({ length: 80, default: '' })
  provincia: string;

  @Column({ length: 80, default: '' })
  departamento: string;

  @Column({ length: 30, default: '' })
  telefonoEmergencia: string;

  @Column({ type: 'text', default: '' })
  foto: string;

  @Column({ length: 5, default: 'O+' })
  grupoSanguineo: string;

  @Column({ type: 'text', default: '' })
  alergias: string;

  @Column({ type: 'text', default: '' })
  condicionesSalud: string;

  @Column({ type: 'text', default: '' })
  observaciones: string;

  @Column({ length: 4, default: '2026' })
  anioIngreso: string;

  @Column({ length: 15, default: 'activo' })
  estadoMatricula: StudentEstadoMatricula;

  /** IE donde el estudiante tiene la matrícula vigente. */
  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  /** Identidad del alumno. No cambia si al año siguiente estudia en otra IE. */
  @Column({ length: 40, default: '' })
  codigoNacional: string;

  @Column({ length: 20, default: 'elegible' })
  estadoCambioSeccion: EstadoCambioSeccion;

  @Column({ length: 3, default: 'AD' })
  conductaNota: string;

  /** regular | pendiente_regularizacion (registro excepcional sin documento). */
  @Column({ length: 30, default: 'regular' })
  estadoDocumento: string;

  @Column({ type: 'text', default: '' })
  sinDocumentoMotivo: string;

  @Column({ type: 'text', default: '' })
  sinDocumentoSustento: string;

  /** Matrícula excepcional por edad fuera de normativa. */
  @Column({ default: false })
  matriculaExcepcional: boolean;

  @Column({ type: 'text', default: '' })
  excepcionalMotivo: string;

  @Column({ type: 'text', default: '' })
  excepcionalSustento: string;

  @Column({ type: 'smallint', nullable: true })
  edadNormativaAlRegistro: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  padre: RepresentanteData;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  madre: RepresentanteData;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  apoderado: RepresentanteData;
}
