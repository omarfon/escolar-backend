/**
 * Carga clases de temario en PostgreSQL (tabla temario_clases).
 * Uso:
 *   npm run db:temario-data           — inserta solo en aulas vacías
 *   npm run db:temario-data -- --repair — sincroniza plantilla, fechas y deduplica
 *
 * Requisitos previos:
 *   - npm run db:seed (o datos equivalentes: docente, asignaciones, currícula)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TemarioService } from '../src/temario/temario.service';
import { DataSource } from 'typeorm';

const ANIO_ESCOLAR = Number(process.env.ANIO_ESCOLAR ?? 2026);
const repair = process.argv.includes('--repair');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const temario = app.get(TemarioService);
    const inserted = await temario.seedTemarioFromTemplate(ANIO_ESCOLAR, { repair });

    const ds = app.get(DataSource);
    const counts = await ds.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM temario_clases WHERE "anioEscolar" = $1`,
      [ANIO_ESCOLAR],
    );

    console.log(`Temario cargado (A.E. ${ANIO_ESCOLAR}):`);
    console.log(`  clases insertadas en esta ejecución: ${inserted}`);
    console.log(`  temario_clases (total):               ${counts[0]?.total ?? '0'} filas`);
    if (repair) {
      console.log('  modo --repair: contenido y fechas sincronizados desde plantilla');
    }
  } finally {
    await app.close();
  }
}

main().catch((err: Error) => {
  console.error('Error al cargar temario:', err.message);
  process.exit(1);
});
