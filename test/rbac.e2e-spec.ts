import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('RBAC control (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  async function login(username: string, password = 'admin123'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
        expect(r.body.accessToken).toBeDefined();
      });
    return res.body.accessToken as string;
  }

  it('GET /rbac/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/rbac/context')
      .expect(401);
  });

  it('GET /rbac/context responde ámbitos y reglas', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/rbac/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.ambitos).toBeDefined();
        expect(res.body.reglaResolucion).toContain('unión');
      });
  });

  it('GET /rbac/audit rechaza usuario sin permiso', async () => {
    const token = await login('docente');
    return request(app.getHttpServer())
      .get('/api/v1/rbac/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /rbac/users/:id/effective-auth muestra permisos efectivos', async () => {
    const token = await login('admin');
    const usersRes = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const users = usersRes.body as Array<{ id: number }>;
    if (!users.length) return;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rbac/users/${users[0].id}/effective-auth`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.permisos).toBeDefined();
    expect(Array.isArray(res.body.permisos)).toBe(true);
  });
});
