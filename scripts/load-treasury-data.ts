/**
 * Carga estado de cuenta demo para familia Pérez López.
 * Requisito previo: conceptos MAT-PRIM/MENS-PRIM (npm run db:treasury-concepts-data o UI).
 * Uso: npm run db:treasury-data
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TreasuryService } from '../src/treasury/treasury.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const treasury = app.get(TreasuryService);
    await treasury.ensureTreasuryDemoData(2026);
    console.log('Estado de cuenta demo (matrícula + mensualidades) listo.');
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
