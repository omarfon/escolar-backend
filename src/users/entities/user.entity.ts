import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole =
  | 'ADMIN'
  | 'DIRECTOR'
  | 'DOCENTE'
  | 'SECRETARIA'
  | 'TESORERO'
  | 'PADRE'
  | 'ESTUDIANTE'
  | 'BIBLIOTECARIO';

export type UserEstado = 'activo' | 'inactivo' | 'bloqueado';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ length: 20 })
  rol: UserRole;

  @Column({ length: 80, default: 'Sede Central' })
  sede: string;

  @Column({ length: 10, default: 'activo' })
  estado: UserEstado;

  @Column({ length: 120, default: '' })
  cargo: string;

  @Column({ length: 100, select: false })
  password: string;

  @Column({ type: 'timestamp', nullable: true })
  ultimoAcceso: Date | null;
}
