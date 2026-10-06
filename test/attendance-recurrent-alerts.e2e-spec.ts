import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Alertas por ausentismo recurrente (e2e)', () => {
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
      .get('/api/v1/attendances/recurrent-alerts/context')
      .expect(401);
  });

  it('expone contexto institucional y permisos', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendances/recurrent-alerts/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('settings');
    expect(res.body.settings).toHaveProperty('diasAlertaAusentismo');
    expect(res.body.settings).toHaveProperty('porcentajeUmbral');
    expect(res.body).toHaveProperty('permisos');
    expect(res.body.permisos.consultar).toBe(true);
  });

  it('lista alertas recurrentes paginadas', async () => {
    const token = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendances/recurrent-alerts')
      .query({ page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('valida motivo obligatorio al cerrar alerta', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .post('/api/v1/attendances/recurrent-alerts/999999/cerrar')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('rechaza escaneo sin autenticación', () => {
    return request(app.getHttpServer())
      .post('/api/v1/attendances/recurrent-alerts/scan')
      .send({})
      .expect(401);
  });

  it('permite escanear con institución y actualizar configuración ampliada', async () => {
    const token = await login('admin');

    const settings = await request(app.getHttpServer())
      .patch('/api/v1/attendances/alert-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        diasAlertaAusentismo: 2,
        diasAlertaCritica: 5,
        porcentajeUmbral: 15,
        periodoTipo: 'mes',
        nivelEducativo: '',
        modalidad: 'todos',
      })
      .expect(200);

    expect(settings.body.porcentajeUmbral).toBe(15);

    const institution = await request(app.getHttpServer())
      .get('/api/v1/institution')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const institutionId = institution.body.id as number;

    const scan = await request(app.getHttpServer())
      .post('/api/v1/attendances/recurrent-alerts/scan')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Institution-Id', String(institutionId))
      .send({ mes: new Date().toISOString().slice(0, 7) })
      .expect((r) => expect([200, 201]).toContain(r.status));

    expect(scan.body).toHaveProperty('creadas');
    expect(scan.body).toHaveProperty('actualizadas');
    expect(scan.body).toHaveProperty('omitidas');
  });
});
