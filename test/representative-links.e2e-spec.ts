import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Representative links (e2e)', () => {
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

  it('GET /representative-links/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/representative-links/context')
      .expect(401);
  });

  it('POST /representative-links/associate rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .post('/api/v1/representative-links/associate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: '99999999',
        representante: { nombres: 'Test Rep' },
        studentIds: [1],
        tipoVinculo: 'apoderado',
        motivo: 'Intento sin permiso',
      })
      .expect(403);
  });

  it('asocia varios estudiantes a un representante y registra auditoría', async () => {
    const token = await login('r.huanca');
    const marker = Date.now().toString().slice(-8);
    const doc = `9${marker.slice(0, 7)}`;

    const studentsRes = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const studentIds = (studentsRes.body as Array<{ id: number }>)
      .slice(0, 2)
      .map((s) => s.id);
    expect(studentIds.length).toBeGreaterThanOrEqual(1);

    const associateRes = await request(app.getHttpServer())
      .post('/api/v1/representative-links/associate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: doc,
        representante: {
          nombres: 'Carlos',
          apellidos: 'Representante Test',
          email: `rep.${marker}@test.pe`,
          telefono: '999888777',
        },
        studentIds,
        tipoVinculo: 'apoderado',
        esPrincipal: true,
        motivo: 'Vinculación familiar múltiple',
      })
      .expect(201);

    expect(associateRes.body.creados.length).toBeGreaterThanOrEqual(1);
    expect(associateRes.body.representante.numeroDocumento).toBe(doc);

    const lookupRes = await request(app.getHttpServer())
      .get('/api/v1/representative-links/by-document')
      .query({ tipoDocumento: 'DNI', numeroDocumento: doc })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lookupRes.body.vinculosActivos.length).toBeGreaterThanOrEqual(1);

    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/representative-links/audit')
      .query({ representativeId: associateRes.body.representante.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items.some((i: { accion: string }) => i.accion === 'crear')).toBe(
      true,
    );

    const duplicateRes = await request(app.getHttpServer())
      .post('/api/v1/representative-links/associate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: doc,
        representante: { nombres: 'Carlos' },
        studentIds: [studentIds[0]],
        tipoVinculo: 'apoderado',
        motivo: 'Reintento duplicado',
      })
      .expect(201);

    expect(
      duplicateRes.body.omitidos.some((o: { razon: string }) =>
        o.razon.includes('vínculo activo'),
      ),
    ).toBe(true);
  });
});
