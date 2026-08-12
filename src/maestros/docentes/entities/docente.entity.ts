import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DocenteTipo = 'nombrado' | 'contratado';
export type DocenteEstado = 'activo' | 'inactivo' | 'bloqueado';

@Entity('docentes')
export class Docente {
  @PrimaryGeneratedColumn()
  id: number;

  /** Usuario del sistema vinculado (login). Nullable si solo es registro académico. */
  @Column({ type: 'int', nullable: true, unique: true })
  userId: number | null;

  @Column({ length: 80 })
  nombres: string;

  @Column({ length: 80 })
  apellidos: string;

  @Column({ length: 8, unique: true })
  dni: string;

  @Column({ length: 120, unique: true })
  email: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 30, default: '' })
  telefono: string;

  @Column({ length: 200, default: '' })
  direccion: string;

  @Column({ length: 80, default: 'Sede Central' })
  sede: string;

  @Column({ length: 10, default: 'activo' })
  estado: DocenteEstado;

  @Column({ length: 120, default: '' })
  especialidad: string;

  @Column({ length: 20, default: 'nombrado' })
  tipo: DocenteTipo;

  @Column({ type: 'int', default: 30 })
  maxHoras: number;

  @Column({ length: 40, default: '' })
  abrev: string;
}

export function abrevDocente(nombres: string, apellidos: string): string {
  const ini = nombres.trim().charAt(0).toUpperCase();
  const ap = apellidos.trim().split(/\s+/)[0] ?? apellidos.trim();
  return ap ? `${ini}. ${ap}` : ini;
}

export function tipoFromEspecialidad(especialidad: string): DocenteTipo {
  return especialidad.toLowerCase().includes('contrat') ? 'contratado' : 'nombrado';
}

export function maxHorasForTipo(tipo: DocenteTipo): number {
  return tipo === 'contratado' ? 24 : 30;
}
