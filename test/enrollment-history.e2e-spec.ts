import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Enrollment history (e2e)', () => {
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

  async function wait(ms = 400): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  it('GET /enrollment-history/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-history/context')
      .expect(401);
  });

  it('GET /enrollment-history rechaza usuario sin permiso de matrícula', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-history/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /enrollment-history/context expone contexto institucional y tipos de evento', async () => {
    const token = await login('r.huanca');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-history/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.institucion.anioEscolar).toBeGreaterThan(2000);
        expect(res.body.permisoConsultar).toBe('matricula.ver');
        expect(res.body.tiposEvento.length).toBeGreaterThan(0);
        expect(res.body.tiposEvento.some((t: { codigo: string }) => t.codigo === 'matricula')).toBe(
          true,
        );
        expect(res.body.tiposEvento.some((t: { codigo: string }) => t.codigo === 'traslado')).toBe(
          true,
        );
      });
  });

  it('listado y detalle de historial con auditoría de consulta', async () => {
    const token = await login('r.huanca');
    const correlationId = `e2e-historial-${Date.now()}`;

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-history')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', correlationId)
      .expect(200);

    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(typeof listRes.body.total).toBe('number');

    if (!listRes.body.items.length) return;

    const student = listRes.body.items[0] as { id: number };
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/enrollment-history/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', correlationId)
      .expect(200);

    expect(detailRes.body.estudiante.id).toBe(student.id);
    expect(detailRes.body.resumen).toBeDefined();
    expect(Array.isArray(detailRes.body.eventosMatricula)).toBe(true);
    expect(Array.isArray(detailRes.body.trayectoriaAcademica)).toBe(true);

    await wait();

    const adminToken = await login('admin');
    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({
        modulo: 'matricula',
        busqueda: correlationId,
        pageSize: 20,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const logs = auditRes.body.items as Array<{
      accion: string;
      entidad?: string;
      entidadId?: string;
    }>;
    expect(logs.some((l) => l.accion === 'consultar' && l.entidad === 'historial_matricula')).toBe(
      true,
    );
    expect(logs.some((l) => l.entidadId === String(student.id))).toBe(true);
  });

  it('GET /enrollment-history/:studentId responde 404 para estudiante inexistente', async () => {
    const token = await login('r.huanca');
    return request(app.getHttpServer())
      .get('/api/v1/enrollment-history/999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /enrollment-history admite búsqueda por texto', async () => {
    const token = await login('r.huanca');
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (!listRes.body.items.length) return;

    const first = listRes.body.items[0] as { nombres: string };
    const term = String(first.nombres).slice(0, 3);
    if (term.length < 2) return;

    const searchRes = await request(app.getHttpServer())
      .get('/api/v1/enrollment-history')
      .query({ q: term })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(searchRes.body.items.length).toBeGreaterThan(0);
  });
});
