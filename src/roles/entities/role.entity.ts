import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30, unique: true })
  codigo: string;

  @Column({ length: 80 })
  label: string;

  @Column({ length: 200, default: '' })
  descripcion: string;

  @Column({ length: 30, default: 'bg-gray-500' })
  color: string;

  @Column({ default: false })
  esAdmin: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions: RolePermission[];
}
