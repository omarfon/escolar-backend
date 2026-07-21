/**
 * Sincroniza documentos de matrícula con estados demo (entregado / pendiente / vencido).
 * Uso: npm run db:student-documents
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
    await seed.seedStudentDocumentsFromDb();
    console.log('Documentos de estudiantes sincronizados desde BD.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
