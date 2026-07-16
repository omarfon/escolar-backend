import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type StudentSexo = 'M' | 'F';
export type StudentEstadoMatricula = 'activo' | 'inactivo' | 'retirado';

export interface RepresentanteData {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  email: string;
  trabajo: string;
}

export const REPRESENTANTE_VACIO: RepresentanteData = {
  nombres: '',
  apellidos: '',
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

  @Column({ length: 8, default: '' })
  dni: string;

  @Column({ type: 'date', nullable: true })
  fechaNac: string | null;

  @Column({ type: 'varchar', length: 1, default: 'M' })
  sexo: StudentSexo;

  @Column({ type: 'text', default: '' })
  direccion: string;

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

  @Column({ length: 3, default: 'AD' })
  conductaNota: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  padre: RepresentanteData;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  madre: RepresentanteData;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  apoderado: RepresentanteData;
}
