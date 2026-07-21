/**
 * Carga datos demo en PostgreSQL (estudiantes, usuarios, temario, etc.).
 * Uso: npm run db:seed
 *
 * Requisitos previos:
 *   - PostgreSQL accesible (.env o variables DB_*)
 *   - Backend compilado o ts-node disponible
 *   - Opcional: npm run db:sedes-data, db:docentes-data, db:horarios-data
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
    await seed.runSeed();
    console.log('Seed de base de datos completado.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al ejecutar seed:', err.message);
  process.exit(1);
});
