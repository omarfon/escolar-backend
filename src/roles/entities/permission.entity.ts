import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 60, unique: true })
  codigo: string;

  @Column({ length: 120 })
  label: string;

  @Column({ length: 60 })
  modulo: string;

  @Column({ length: 40, default: 'lock' })
  icono: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions: RolePermission[];
}
