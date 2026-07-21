/**
 * Sincroniza vínculos apoderado ↔ alumno en parent_students desde BD.
 * Uso: npm run db:parent-links
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseSeedService } from '../src/database/database-seed.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seed = app.get(DatabaseSeedService);
    await seed.syncParentLinksFromDb();
    console.log('Vínculos padre/alumno sincronizados desde BD.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
