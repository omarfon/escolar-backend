import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_reset_tokens')
@Index('idx_password_reset_token_hash', ['tokenHash'], { unique: true })
@Index('idx_password_reset_user_active', ['userId', 'usedAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({ length: 45, default: '' })
  requestIp: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
