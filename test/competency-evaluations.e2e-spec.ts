import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Registro calificaciones por competencia (e2e)', () => {
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

  it('exige autenticación en contexto de registro', () => {
    return request(app.getHttpServer())
      .get('/api/v1/competency-evaluations/registry/context')
      .expect(401);
  });

  it('expone contexto institucional de registro', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/competency-evaluations/registry/context?bimestre=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('bimestreActual');
    expect(res.body).toHaveProperty('contexts');
    expect(res.body).toHaveProperty('permisos');
    expect(res.body.permisos.consultar).toBe(true);
  });

  it('rechaza bulk sin autenticación', () => {
    return request(app.getHttpServer())
      .post('/api/v1/competency-evaluations/bulk')
      .send({
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        bimestre: 1,
        entries: [],
      })
      .expect(401);
  });

  it('rechaza auditoría sin permiso de reportes', async () => {
    const token = await login('estudiante');
    await request(app.getHttpServer())
      .get('/api/v1/competency-evaluations/change-audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('valida payload bulk incompleto', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .post('/api/v1/competency-evaluations/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ bimestre: 1, entries: [] })
      .expect(400);
  });

  it('auditoría de cambios accesible para admin', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/competency-evaluations/change-audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('pagination');
  });
});
