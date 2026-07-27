/**
 * Carga catálogos demo de estudiantes, perfiles, documentos, entregas y eventos
 * desde *-seed.data.ts hacia PostgreSQL.
 * Uso: npm run db:demo-student-catalog
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
    await seed.seedDemoStudentCatalogFromFiles();
    console.log('Catálogo demo de estudiantes cargado en PostgreSQL.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar catálogo demo:', err.message);
  process.exit(1);
});
