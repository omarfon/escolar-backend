# Escolar Backend (NestJS + PostgreSQL)

Backend API para integrar el frontend `escolar`.

## Stack

- NestJS
- TypeORM
- PostgreSQL (`pg`)
- Validación global con `class-validator`
- Prefijo API: `/api/v1`

## Variables de entorno

Copia `.env.example` a `.env`. Para Docker local use **127.0.0.1** (no `localhost`, evita problemas IPv6 en Windows):

```bash
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=escolar
```

## Levantar PostgreSQL (Docker)

1. Abra **Docker Desktop** y espere a que muestre **Running**.
2. En la raíz del backend:

```bash
npm run db:up
```

Comandos útiles:

| Comando | Descripción |
|---------|-------------|
| `npm run db:up` | Levanta PostgreSQL y espera conexión |
| `npm run db:down` | Detiene el contenedor |
| `npm run db:reset` | Borra volumen y crea BD limpia |
| `npm run db:logs` | Logs del contenedor |
| `npm run db:wait` | Solo espera a que PostgreSQL responda |

### Si Docker o la BD no conectan

- Error `Connection terminated unexpectedly`: Docker suele estar colgado. **Reinicie Docker Desktop** (clic derecho en el icono → Restart), luego `npm run db:reset`.
- Si `docker compose` no responde: cierre Docker Desktop desde el administrador de tareas y ábralo de nuevo.
- Verifique el puerto: `netstat -ano | findstr :5433` debe mostrar `com.docker.backend.exe`.

## Ejecutar backend

```bash
npm install
npm run start:dev:db
```

O por separado: `npm run db:up` y luego `npm run start:dev`.

## Endpoints principales

- `POST /api/v1/auth/login`
- `GET|POST|PATCH|DELETE /api/v1/students`
- `GET|POST|PATCH|DELETE /api/v1/courses`
- `GET|POST|PATCH|DELETE /api/v1/schedules`
- `GET|POST|PATCH|DELETE /api/v1/grades`
- `GET|POST|PATCH|DELETE /api/v1/attendances`
- `GET|POST|PATCH|DELETE /api/v1/tasks`
- `GET|POST|PATCH|DELETE /api/v1/announcements`

## Notas

- El seeder inicial carga datos demo si la BD está vacía.
- `synchronize: true` está activo para desarrollo.
