/**
 * Carga eventos demo en PostgreSQL desde eventos-seed.data.ts
 * Uso: npm run db:events-data
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
    await seed.seedEventsFromCatalog();
    console.log('Eventos demo cargados en PostgreSQL.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar eventos demo:', err.message);
  process.exit(1);
});
