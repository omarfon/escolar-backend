import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Validación automática de rangos (e2e)', () => {
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

  it('expone rangos en el contexto de escala', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/grading-config/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.validacionRangos).toBeDefined();
    expect(res.body.validacionRangos.min).toBe(0);
    expect(res.body.validacionRangos.max).toBe(20);
    expect(res.body.validacionRangos.mensaje).toContain('0');
  });

  it('rechaza registro masivo con nota fuera de rango', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .post('/api/v1/grades/registry/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        curso: 'Matemática',
        bimestre: 1,
        fechaEvaluacion: '2026-04-01',
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        entries: [
          {
            studentId: 1,
            componenteCodigo: 'EXAMEN',
            nota: 25,
          },
        ],
      })
      .expect(400);
  });

  it('rechaza bulk sin autenticación', () => {
    return request(app.getHttpServer())
      .post('/api/v1/grades/registry/bulk')
      .send({
        curso: 'Matemática',
        bimestre: 1,
        fechaEvaluacion: '2026-04-01',
        entries: [{ studentId: 1, componenteCodigo: 'EXAMEN', nota: 15 }],
      })
      .expect(401);
  });
});
