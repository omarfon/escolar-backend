import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Audit logs / access logs (e2e)', () => {
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

  async function waitForAudit(ms = 300): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  it('GET /audit-logs requiere autenticación', () => {
    return request(app.getHttpServer()).get('/api/v1/audit-logs').expect(401);
  });

  it('GET /audit-logs rechaza usuario sin permiso admin.reportes', async () => {
    const token = await login('docente');
    return request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('POST /audit-logs bloquea creación manual (append-only)', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .post('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accion: 'login',
        modulo: 'autenticacion',
        entidad: 'sesion',
        descripcion: 'Intento manual',
      })
      .expect(403);
  });

  it('GET /audit-logs/context expone institución y retención', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/audit-logs/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.retencionDias).toBeGreaterThan(0);
        expect(res.body.permisoConsulta).toBe('admin.reportes');
      });
  });

  it('login exitoso aparece en bitácora tipo=accesos con correlationId', async () => {
    const correlationId = `e2e-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-correlation-id', correlationId)
      .send({ username: 'admin', password: 'admin123' })
      .expect((r) => expect([200, 201]).toContain(r.status));

    await waitForAudit();

    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ tipo: 'accesos', busqueda: correlationId, pageSize: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    const loginEvent = res.body.items.find(
      (i: { accion: string; correlationId: string | null }) =>
        i.accion === 'login' && i.correlationId === correlationId,
    );
    expect(loginEvent).toBeDefined();
    expect(loginEvent.resultado).toBe('success');
    expect(loginEvent.modulo).toBe('autenticacion');
  });

  it('GET /audit-logs/export devuelve CSV para usuario autorizado', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs/export')
      .query({ tipo: 'accesos' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('id,fecha,hora,usuario');
  });
});
