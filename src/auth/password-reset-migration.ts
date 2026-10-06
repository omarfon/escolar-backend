import { DataSource } from 'typeorm';

export async function preparePasswordResetTables(ds: DataSource): Promise<void> {
  await ds.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "tokenHash" varchar(64) NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "usedAt" timestamp NULL,
      "requestIp" varchar(45) NOT NULL DEFAULT '',
      "idempotencyKey" varchar(64) NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token_hash
    ON password_reset_tokens ("tokenHash")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_user_active
    ON password_reset_tokens ("userId", "usedAt")
  `);

  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_idempotency
    ON password_reset_tokens ("idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL
  `);
}
