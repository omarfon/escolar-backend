import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Evaluation reports (e2e)', () => {
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

  it('GET /evaluation-reports/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/evaluation-reports/context')
      .expect(401);
  });

  it('GET /evaluation-reports/context responde contexto institucional', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/evaluation-reports/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.permisoConsulta).toBe('evaluacion.reportes');
        expect(res.body.tiposDisponibles).toContain('promedios');
      });
  });

  it('GET /evaluation-reports rechaza usuario sin permiso', async () => {
    const token = await login('estudiante');
    return request(app.getHttpServer())
      .get('/api/v1/evaluation-reports?tipo=promedios&nivel=Primaria&grado=1&seccion=A')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /evaluation-reports valida filtros obligatorios', async () => {
    const token = await login('docente');
    return request(app.getHttpServer())
      .get('/api/v1/evaluation-reports?tipo=promedios')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('GET /evaluation-reports responde reporte paginado de promedios', async () => {
    const token = await login('docente');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/grades/registry/contexts?bimestre=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const contexts = ctxRes.body.contexts as Array<{
      nivel: string;
      grado: string;
      seccion: string;
    }>;
    if (!contexts.length) return;

    const ctx = contexts[0];
    return request(app.getHttpServer())
      .get(
        `/api/v1/evaluation-reports?tipo=promedios&nivel=${encodeURIComponent(ctx.nivel)}&grado=${encodeURIComponent(ctx.grado)}&seccion=${encodeURIComponent(ctx.seccion)}&page=1&pageSize=10`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.fuente).toBe('tabla_promedios');
        expect(res.body.pagination).toBeDefined();
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });

  it('GET /evaluation-reports/export genera CSV', async () => {
    const token = await login('admin');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/grades/registry/contexts?bimestre=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const contexts = ctxRes.body.contexts as Array<{
      nivel: string;
      grado: string;
      seccion: string;
    }>;
    if (!contexts.length) return;

    const ctx = contexts[0];
    return request(app.getHttpServer())
      .get(
        `/api/v1/evaluation-reports/export?tipo=promedios&format=csv&nivel=${encodeURIComponent(ctx.nivel)}&grado=${encodeURIComponent(ctx.grado)}&seccion=${encodeURIComponent(ctx.seccion)}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
  });
});
