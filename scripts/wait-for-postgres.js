/**
 * Espera a que PostgreSQL acepte conexiones antes de arrancar el backend.
 * Uso: node scripts/wait-for-postgres.js
 */
const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5433),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'escolar',
  connectionTimeoutMillis: 5000,
};

const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryConnect() {
  const client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (err) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return err;
  }
}

async function main() {
  console.log(
    `Esperando PostgreSQL en ${config.host}:${config.port}/${config.database} ...`,
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await tryConnect();
    if (result === true) {
      console.log(`PostgreSQL listo (intento ${attempt}/${maxAttempts}).`);
      process.exit(0);
    }

    const message =
      result instanceof Error ? result.message : 'conexión rechazada';
    console.log(
      `[${attempt}/${maxAttempts}] Aún no disponible: ${message}`,
    );

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  console.error('');
  console.error('No se pudo conectar a PostgreSQL.');
  console.error('Pasos sugeridos:');
  console.error('  1. Abra Docker Desktop y espere a que diga "Running".');
  console.error('  2. En esta carpeta ejecute: npm run db:up');
  console.error('  3. Si sigue fallando: npm run db:reset');
  console.error(
    `  4. Verifique .env → DB_HOST=${config.host} DB_PORT=${config.port}`,
  );
  process.exit(1);
}

main();
