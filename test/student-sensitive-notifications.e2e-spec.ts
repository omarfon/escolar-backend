import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Student sensitive data notifications (e2e)', () => {
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

  async function wait(ms = 400): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  it('GET /students/sensitive-notifications/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/sensitive-notifications/context')
      .expect(401);
  });

  it('GET /students/sensitive-notifications rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/students/sensitive-notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /students/sensitive-notifications/context expone campos sensibles', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/students/sensitive-notifications/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.camposSensibles).toBeDefined();
        expect(res.body.camposSensibles.length).toBeGreaterThan(0);
        expect(res.body.permisoConsulta).toBe('estudiantes.expediente');
      });
  });

  it('PATCH datos sensibles genera notificación consultable', async () => {
    const token = await login('r.huanca');
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const students = listRes.body as Array<{ id: number; nombres: string }>;
    if (!students.length) return;

    const student = students[0];
    const marker = `sensitive-e2e-${Date.now()}`;

    await request(app.getHttpServer())
      .patch(`/api/v1/students/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        direccion: marker,
        auditMotivo: 'Prueba E2E notificación datos sensibles',
      })
      .expect(200);

    await wait();

    const notifRes = await request(app.getHttpServer())
      .get('/api/v1/students/sensitive-notifications')
      .query({ studentId: student.id, pageSize: 20 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(notifRes.body.items).toBeDefined();
    const match = notifRes.body.items.find(
      (n: { motivo?: string; camposNotificados?: string[] }) =>
        n.motivo === 'Prueba E2E notificación datos sensibles' ||
        n.camposNotificados?.includes('direccion'),
    );
    expect(match).toBeDefined();
    expect(match.camposLabels).toBeDefined();
  });
});
