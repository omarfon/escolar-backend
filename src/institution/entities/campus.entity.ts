import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('campuses')
export class Campus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 20, default: '' })
  codigo: string;

  @Column({ length: 200, default: '' })
  direccion: string;

  @Column({ length: 80, default: '' })
  distrito: string;

  @Column({ length: 80, default: '' })
  provincia: string;

  @Column({ length: 80, default: '' })
  region: string;

  @Column({ length: 30, default: '' })
  telefono: string;

  @Column({ length: 120, default: '' })
  email: string;

  @Column({ length: 120, default: '' })
  director: string;

  @Column({ type: 'jsonb', default: [] })
  niveles: string[];

  @Column({ type: 'jsonb', default: [] })
  turnos: string[];

  @Column({ length: 10, default: 'activo' })
  estado: 'activo' | 'inactivo';
}
