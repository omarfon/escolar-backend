import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Territorial reports (e2e)', () => {
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

  it('GET /territorial-reports/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/territorial-reports/context')
      .expect(401);
  });

  it('GET /territorial-reports/context responde para admin', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/territorial-reports/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.permisoConsulta).toBe('dashboard.reportes');
        expect(res.body.tiposDisponibles).toContain('consolidado_ugel_dre');
      });
  });

  it('GET /territorial-reports rechaza estudiante', async () => {
    const token = await login('estudiante');
    return request(app.getHttpServer())
      .get('/api/v1/territorial-reports?tipo=consolidado_ugel_dre')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /territorial-reports consolidado', async () => {
    const token = await login('admin');
    const mes = new Date().toISOString().slice(0, 7);
    return request(app.getHttpServer())
      .get(
        `/api/v1/territorial-reports?tipo=consolidado_ugel_dre&bimestre=2&mes=${mes}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.fuente).toBe(
          'agregado_territorial_matricula_asistencia_evaluacion',
        );
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });
});
