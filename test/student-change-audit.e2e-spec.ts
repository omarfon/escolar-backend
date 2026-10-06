import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Student change audit (e2e)', () => {
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

  it('GET /students/change-audit/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/change-audit/context')
      .expect(401);
  });

  it('GET /students/change-audit/context responde contexto institucional', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/students/change-audit/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.retencionDias).toBeGreaterThan(0);
        expect(res.body.permisoConsulta).toBe('estudiantes.expediente');
      });
  });

  it('GET /students/change-audit rechaza usuario sin permiso de consulta', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/students/change-audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('PATCH estudiante rechaza usuario sin permiso de edición', async () => {
    const token = await login('p.vargas');
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const students = listRes.body as Array<{ id: number }>;
    if (!students.length) return;

    await request(app.getHttpServer())
      .patch(`/api/v1/students/${students[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        direccion: 'Intento sin permiso',
        auditMotivo: 'Prueba E2E permiso edición',
      })
      .expect(403);
  });

  it('PATCH estudiante sin motivo devuelve 400', async () => {
    const token = await login('r.huanca');
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const students = listRes.body as Array<{ id: number }>;
    if (!students.length) return;

    await request(app.getHttpServer())
      .patch(`/api/v1/students/${students[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direccion: 'Sin motivo test' })
      .expect(400);
  });

  it('PATCH estudiante genera registro consultable en auditoría', async () => {
    const token = await login('r.huanca');
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const students = listRes.body as Array<{
      id: number;
      nombres: string;
      observaciones?: string;
    }>;
    if (!students.length) {
      return;
    }

    const student = students[0];
    const marker = `audit-e2e-${Date.now()}`;
    await request(app.getHttpServer())
      .patch(`/api/v1/students/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: student.nombres,
        observaciones: marker,
        auditMotivo: 'Prueba E2E auditoría de cambios',
      })
      .expect(200);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${student.id}/change-audit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items).toBeDefined();
    expect(Array.isArray(auditRes.body.items)).toBe(true);
    const latest = auditRes.body.items.find(
      (row: { motivo?: string; cambios?: Record<string, unknown> }) =>
        row.motivo === 'Prueba E2E auditoría de cambios' ||
        row.cambios?.observaciones,
    );
    expect(latest).toBeDefined();
    expect(latest.accion).toBe('actualizar');
    expect(latest.resultado).toBe('success');
  });
});
