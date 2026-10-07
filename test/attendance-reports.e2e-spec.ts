import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Attendance reports (e2e)', () => {
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
      });
    return res.body.accessToken as string;
  }

  it('GET /attendance-reports/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/attendance-reports/context')
      .expect(401);
  });

  it('GET /attendance-reports/context responde contexto', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/attendance-reports/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.permisoConsulta).toBe('asistencia.reportes');
        expect(res.body.tiposDisponibles).toContain('asistencia_resumen');
      });
  });

  it('GET /attendance-reports rechaza usuario sin permiso', async () => {
    const token = await login('estudiante');
    return request(app.getHttpServer())
      .get('/api/v1/attendance-reports?tipo=asistencia_resumen')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /attendance-reports resumen por mes', async () => {
    const token = await login('admin');
    const mes = new Date().toISOString().slice(0, 7);
    return request(app.getHttpServer())
      .get(`/api/v1/attendance-reports?tipo=asistencia_resumen&mes=${mes}&institutionId=1&_tenant=x`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.tipo).toBe('asistencia_resumen');
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });
});
