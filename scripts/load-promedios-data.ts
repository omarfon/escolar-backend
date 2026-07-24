/**
 * Carga promedios demo en tabla promedios (solo desarrollo/manual).
 * No se ejecuta al iniciar el servidor. Uso: npm run db:promedios-data
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PromediosService } from '../src/promedios/promedios.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(PromediosService);
    const inserted = await svc.seedDemo(true);
    console.log(`Promedios cargados: ${inserted} fila(s) en tabla promedios.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
