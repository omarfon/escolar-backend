import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('representatives')
@Index(['tipoDocumento', 'numeroDocumento'], { unique: true })
export class Representative {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 15, default: 'DNI' })
  tipoDocumento: string;

  @Column({ length: 20 })
  numeroDocumento: string;

  @Column({ length: 80 })
  nombres: string;

  @Column({ length: 80, default: '' })
  apellidos: string;

  @Column({ length: 80, default: '' })
  apellidoPaterno: string;

  @Column({ length: 80, default: '' })
  apellidoMaterno: string;

  @Column({ length: 120, default: '' })
  email: string;

  @Column({ length: 30, default: '' })
  telefono: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
