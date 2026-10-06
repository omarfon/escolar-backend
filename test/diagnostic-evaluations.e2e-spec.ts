import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Evaluación diagnóstica (e2e)', () => {
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
      .get('/api/v1/diagnostic-evaluations/registry/context')
      .expect(401);
  });

  it('expone contexto institucional de evaluación diagnóstica', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/diagnostic-evaluations/registry/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.bimestre).toBe(1);
    expect(res.body).toHaveProperty('contexts');
    expect(res.body).toHaveProperty('permisos');
    expect(res.body).toHaveProperty('modoRegistro');
    expect(res.body.permisos.consultar).toBe(true);
  });

  it('rechaza bulk sin autenticación', () => {
    return request(app.getHttpServer())
      .post('/api/v1/diagnostic-evaluations/bulk')
      .send({
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        curso: 'Comunicación',
        fechaEvaluacion: '2026-03-01',
        entries: [{ studentId: 1, nota: 15 }],
      })
      .expect(401);
  });

  it('rechaza bulk sin permiso de registro', async () => {
    const token = await login('estudiante');
    await request(app.getHttpServer())
      .post('/api/v1/diagnostic-evaluations/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        curso: 'Comunicación',
        fechaEvaluacion: '2026-03-01',
        entries: [{ studentId: 1, nota: 15 }],
      })
      .expect(403);
  });

  it('valida payload bulk incompleto', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .post('/api/v1/diagnostic-evaluations/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ curso: 'Comunicación', entries: [] })
      .expect(400);
  });

  it('registra evaluación diagnóstica y deja auditoría consultable', async () => {
    const token = await login('admin');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/diagnostic-evaluations/registry/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const contexts = ctxRes.body.contexts as Array<{
      nivel: string;
      grado: string;
      seccion: string;
      cursoSugerido: string;
    }>;
    if (!contexts?.length) return;

    const ctx = contexts[0];
    const regRes = await request(app.getHttpServer())
      .get('/api/v1/diagnostic-evaluations/registry')
      .query({
        nivel: ctx.nivel,
        grado: ctx.grado,
        seccion: ctx.seccion,
        curso: ctx.cursoSugerido,
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const alumnos = regRes.body.alumnos as Array<{ studentId: number }>;
    if (!alumnos?.length) return;

    const alumno = alumnos[0];
    await request(app.getHttpServer())
      .post('/api/v1/diagnostic-evaluations/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nivel: ctx.nivel,
        grado: ctx.grado,
        seccion: ctx.seccion,
        curso: ctx.cursoSugerido,
        fechaEvaluacion: '2026-03-10',
        auditMotivo: 'Prueba E2E evaluación diagnóstica',
        entries: [{ studentId: alumno.studentId, nota: 13.5 }],
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
        expect(r.body.saved).toBeGreaterThanOrEqual(1);
      });

    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/diagnostic-evaluations/change-audit')
      .query({ curso: ctx.cursoSugerido, pageSize: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items?.length).toBeGreaterThanOrEqual(1);
  });
});
