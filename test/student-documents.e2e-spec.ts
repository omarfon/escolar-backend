import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Student documents upload (e2e)', () => {
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

  it('GET /students/documents/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/documents/context')
      .expect(401);
  });

  it('POST upload rechaza usuario sin permiso de carga', async () => {
    const token = await login('p.vargas');
    const buffer = Buffer.from('%PDF-1.4 test');
    return request(app.getHttpServer())
      .post('/api/v1/students/1/documents/1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'fut.pdf')
      .field('motivo', 'Intento sin permiso')
      .expect(403);
  });

  it('carga documento con versión, hash y auditoría', async () => {
    const token = await login('r.huanca');

    const studentsRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const studentId = (studentsRes.body as Array<{ id: number }>)[0]?.id;
    expect(studentId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/students/${studentId}/documents/sync-requisitos`)
      .set('Authorization', `Bearer ${token}`)
      .expect((r) => expect([200, 201]).toContain(r.status));

    const docsRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${studentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const doc = (docsRes.body.documentos as Array<{ id?: number; registrado: boolean }>).find(
      (d) => d.registrado && d.id,
    );
    expect(doc?.id).toBeDefined();

    const versionsBeforeRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${studentId}/documents/${doc!.id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const versionsBefore = versionsBeforeRes.body.length as number;
    const pdf = Buffer.from(`%PDF-1.4 escolar test ${Date.now()}`);
    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/students/${studentId}/documents/${doc!.id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf, 'ficha-matricula.pdf')
      .field('motivo', 'Entrega FUT en secretaría')
      .expect(201);

    expect(uploadRes.body.archivo.version).toBe(versionsBefore + 1);
    expect(uploadRes.body.archivo.sha256).toHaveLength(64);
    expect(uploadRes.body.documento.estado).toBe('entregado');

    const versionsRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${studentId}/documents/${doc!.id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versionsRes.body.length).toBeGreaterThanOrEqual(1);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${studentId}/documents/audit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items.some((i: { accion: string }) => i.accion === 'subir')).toBe(true);
  });
});
