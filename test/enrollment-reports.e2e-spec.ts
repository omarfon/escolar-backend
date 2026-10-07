import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Enrollment reports (e2e)', () => {
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

  it('GET /enrollment-reports/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-reports/context')
      .expect(401);
  });

  it('GET /enrollment-reports/context responde contexto', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-reports/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.permisoConsulta).toBe('matricula.reportes');
        expect(res.body.tiposDisponibles).toContain('matricula_global');
      });
  });

  it('GET /enrollment-reports rechaza usuario sin permiso', async () => {
    const token = await login('estudiante');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-reports?tipo=matricula_global')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /enrollment-reports acepta institutionId del tenant', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-reports?tipo=matricula_global&institutionId=1&_tenant=x')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta).toBeDefined();
        expect(res.body.pagination).toBeDefined();
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });

  it('GET /enrollment-reports resumen por aula', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-reports?tipo=matricula_resumen')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.tipo).toBe('matricula_resumen');
        expect(res.body.meta.fuente).toBe('agregado_students_por_aula');
      });
  });
});
