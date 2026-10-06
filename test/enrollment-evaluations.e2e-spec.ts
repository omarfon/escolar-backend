import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Enrollment evaluations (e2e)', () => {
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

  it('GET /enrollment-evaluations/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations/context')
      .expect(401);
  });

  it('GET /enrollment-evaluations/context rechaza usuario sin permiso de matrícula', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /enrollment-evaluations/context responde catálogos institucionales', async () => {
    const token = await login('r.huanca');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.permisoRegistrar).toBe('matricula.evaluacion');
        expect(res.body.tiposEvaluacion.length).toBeGreaterThan(0);
        expect(res.body.fechaMin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
  });

  it('POST /enrollment-evaluations rechaza usuario sin permiso de registro', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .post('/api/v1/enrollment-evaluations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId: 1,
        tipoEvaluacion: 'Entrevista con apoderado',
        fechaEvaluacion: '2026-03-01',
        resultado: 'aprobado',
        resolucion: 'Resolución de prueba con suficiente longitud',
      })
      .expect(403);
  });

  it('registra evaluación con auditoría, detalle e idempotencia', async () => {
    const token = await login('admin');

    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const waitlistRes = await request(app.getHttpServer())
      .get('/api/v1/waitlist')
      .query({ estado: 'en_espera' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const waitlistEntries = waitlistRes.body as Array<{ id: number }>;
    expect(waitlistEntries.length).toBeGreaterThan(0);

    let eligRes: { body: Record<string, unknown> } | null = null;
    for (const entry of waitlistEntries) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/enrollment-evaluations/waitlist/${entry.id}/eligibility`)
        .set('Authorization', `Bearer ${token}`);
      if (res.status === 200 && res.body.elegible && res.body.tiposDisponibles?.length) {
        eligRes = res;
        break;
      }
    }

    if (!eligRes) {
      const studentsRes = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const student = (studentsRes.body as Array<{ id: number; estado?: string }>).find(
        (s) => s.estado !== 'retirado',
      );
      expect(student?.id).toBeDefined();
      eligRes = await request(app.getHttpServer())
        .get(`/api/v1/enrollment-evaluations/students/${student!.id}/eligibility`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }

    expect(eligRes.body.elegible).toBe(true);
    expect(eligRes.body.tiposDisponibles.length).toBeGreaterThan(0);

    const tipo = eligRes.body.tiposDisponibles[0] as string;
    const fechaEvaluacion = ctxRes.body.fechaMax as string;
    const idempotencyKey = `e2e-eval-${Date.now()}`;

    const payload =
      eligRes.body.waitlistEntryId != null
        ? {
            waitlistEntryId: eligRes.body.waitlistEntryId as number,
            tipoEvaluacion: tipo,
            fechaEvaluacion,
            resultado: 'aprobado',
            puntaje: 16,
            observaciones: 'Evaluación E2E automatizada',
            resolucion: 'Resolución de prueba E2E con sustento documentado para auditoría',
          }
        : {
            studentId: eligRes.body.studentId as number,
            tipoEvaluacion: tipo,
            fechaEvaluacion,
            resultado: 'aprobado',
            puntaje: 16,
            observaciones: 'Evaluación E2E automatizada',
            resolucion: 'Resolución de prueba E2E con sustento documentado para auditoría',
          };

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/enrollment-evaluations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', idempotencyKey)
      .send(payload)
      .expect((r) => expect([200, 201]).toContain(r.status));

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.tipoEvaluacion).toBe(tipo);
    expect(createRes.body.actorNombre).toBeTruthy();
    expect(createRes.body.cambios).toBeDefined();

    const dupRes = await request(app.getHttpServer())
      .post('/api/v1/enrollment-evaluations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', idempotencyKey)
      .send(payload)
      .expect((r) => expect([200, 201]).toContain(r.status));

    expect(dupRes.body.id).toBe(createRes.body.id);
    expect(dupRes.body.duplicadoIdempotente).toBe(true);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/enrollment-evaluations/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detailRes.body.resolucion).toBe(payload.resolucion);

    const listQuery =
      'waitlistEntryId' in payload
        ? { waitlistEntryId: payload.waitlistEntryId, page: 1, pageSize: 20 }
        : { studentId: payload.studentId, page: 1, pageSize: 20 };

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations')
      .query(listQuery)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.items.some((i: { id: number }) => i.id === createRes.body.id)).toBe(
      true,
    );
    expect(listRes.body.pagination.totalItems).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/v1/enrollment-evaluations')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `e2e-dup-tipo-${Date.now()}`)
      .send(payload)
      .expect(409);
  });

  it('POST /enrollment-evaluations valida resolución mínima', async () => {
    const token = await login('admin');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-evaluations/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const waitlistRes = await request(app.getHttpServer())
      .get('/api/v1/waitlist')
      .query({ estado: 'en_espera' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const entry = (waitlistRes.body as Array<{ id: number }>)[0];
    expect(entry?.id).toBeDefined();

    const eligRes = await request(app.getHttpServer())
      .get(`/api/v1/enrollment-evaluations/waitlist/${entry!.id}/eligibility`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (!eligRes.body.elegible || !eligRes.body.tiposDisponibles.length) {
      return;
    }

    await request(app.getHttpServer())
      .post('/api/v1/enrollment-evaluations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        waitlistEntryId: entry!.id,
        tipoEvaluacion: eligRes.body.tiposDisponibles[0],
        fechaEvaluacion: ctxRes.body.fechaMax,
        resultado: 'observado',
        resolucion: 'corta',
      })
      .expect(400);
  });
});
