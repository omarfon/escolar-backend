# Escolar Backend (NestJS + PostgreSQL)

Backend API para integrar el frontend `escolar`.

## Stack

- NestJS
- TypeORM
- PostgreSQL (`pg`)
- Validación global con `class-validator`
- Prefijo API: `/api/v1`

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```bash
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=escolar
```

## Levantar PostgreSQL (opcional con Docker)

```bash
docker compose up -d
```

## Ejecutar backend

```bash
npm install
npm run start:dev
```

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
