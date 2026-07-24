/**
 * Crea/actualiza el alumno demo del login (estudiante / admin123) y sus asistencias del año actual.
 * Uso: npm run db:demo-student
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
    await seed.seedDemoLoginStudent();
    console.log('Alumno demo listo (estudiante@escolar.pe).');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar alumno demo:', err.message);
  process.exit(1);
});
