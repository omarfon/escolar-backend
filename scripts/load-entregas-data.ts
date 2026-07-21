/**
 * Matricula alumnos demo en Primaria 5° A y sincroniza tareas de entregas.
 * Uso: npm run db:entregas-data
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
    await seed.seedEntregasDemo();
    console.log('Datos de entregas (salón + tareas) listos.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar entregas demo:', err.message);
  process.exit(1);
});
