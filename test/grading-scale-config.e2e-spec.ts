import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Configuración de escala de evaluación (e2e)', () => {
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

  it('exige autenticación en contexto', () => {
    return request(app.getHttpServer())
      .get('/api/v1/grading-config/context')
      .expect(401);
  });

  it('expone contexto con escalas por nivel', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/grading-config/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('config');
    expect(res.body.config).toHaveProperty('sistemaEval');
    expect(res.body.config).toHaveProperty('modalidad');
    expect(res.body).toHaveProperty('escalasPorNivel');
    expect(res.body.permisos.configurar).toBe(true);
  });

  it('valida umbrales inconsistentes al actualizar', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .patch('/api/v1/grading-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        escalaLogro: { AD: 12, A: 14, B: 11 },
        notaMinima: 11,
      })
      .expect(400);
  });

  it('actualiza escala institucional y registra historial', async () => {
    const token = await login('admin');

    await request(app.getHttpServer())
      .patch('/api/v1/grading-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sistemaEval: 'mixto',
        tipoPeriodo: 'bimestre',
        notaMinima: 11,
        escalaLogro: { AD: 17.5, A: 14, B: 11 },
        motivo: 'Prueba E2E escala evaluación',
      })
      .expect(200);

    const history = await request(app.getHttpServer())
      .get('/api/v1/grading-config/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(history.body.items.length).toBeGreaterThan(0);
    expect(history.body.items[0]).toHaveProperty('valorAnterior');
    expect(history.body.items[0]).toHaveProperty('valorNuevo');
  });
});
