import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AmbitoTerritorial = 'MINEDU' | 'DRE' | 'UGEL' | 'IE';

@Entity('user_role_assignments')
@Index('idx_user_role_active', ['userId', 'activo'])
export class UserRoleAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ length: 30 })
  roleCodigo: string;

  @Column({ length: 10 })
  ambito: AmbitoTerritorial;

  @Column({ type: 'varchar', length: 40, nullable: true })
  dreCodigo: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  ugelCodigo: string | null;

  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  @Column({ default: false })
  esPrincipal: boolean;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
