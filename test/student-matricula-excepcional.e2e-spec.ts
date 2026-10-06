import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Student matricula excepcional (e2e)', () => {
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

  it('GET /students/matricula-excepcional/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/matricula-excepcional/context')
      .expect(401);
  });

  it('POST /students/matricula-excepcional rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .post('/api/v1/students/matricula-excepcional')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: 'Test',
        apellidos: 'Excepcional',
        dni: '71234567',
        fechaNac: '2010-01-01',
        gradoLabel: '2° Primaria',
        seccion: 'A',
        excepcionalMotivo: 'Rezagado con resolución directoral',
        excepcionalSustento: 'Resolución directoral de prueba E2E',
      })
      .expect(403);
  });

  it('POST /students rechaza edad fuera de normativa en matrícula regular', async () => {
    const token = await login('r.huanca');
    const dni = `9${Date.now().toString().slice(-7)}`;
    return request(app.getHttpServer())
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: 'Regular',
        apellidos: 'Edad Fail',
        dni,
        email: `test.${dni}@estudiante.pe`,
        fechaNac: '2010-01-01',
        gradoLabel: '2° Primaria',
        seccion: 'A',
      })
      .expect(400);
  });

  it('registra matrícula excepcional con auditoría', async () => {
    const token = await login('r.huanca');
    const marker = `Exc${Date.now().toString().slice(-6)}`;
    const dni = `9${Date.now().toString().slice(-7)}`;
    const correlationId = `e2e-exc-${Date.now()}`;

    const ageRes = await request(app.getHttpServer())
      .post('/api/v1/students/matricula-excepcional/check-age')
      .set('Authorization', `Bearer ${token}`)
      .send({ fechaNac: '2010-01-01', gradoLabel: '2° Primaria' })
      .expect(201);

    expect(ageRes.body.requiereExcepcional).toBe(true);

    const res = await request(app.getHttpServer())
      .post('/api/v1/students/matricula-excepcional')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', correlationId)
      .send({
        nombres: marker,
        apellidos: 'Excepcional Test',
        dni,
        fechaNac: '2010-01-01',
        sexo: 'M',
        gradoLabel: '2° Primaria',
        seccion: 'B',
        excepcionalMotivo: 'Rezagado con resolución directoral',
        excepcionalSustento: 'Resolución directoral E2E con sustento documentado',
        confirmarDuplicado: true,
      })
      .expect((r) => expect([200, 201]).toContain(r.status));

    expect(res.body.matriculaExcepcional).toBe(true);
    expect(res.body.excepcionalMotivo).toContain('Rezagado');
    expect(res.body.edadNormativaAlRegistro).toBeGreaterThan(7);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${res.body.id}/change-audit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items.some((i: { accion: string }) => i.accion === 'crear')).toBe(
      true,
    );

    await wait();

    const adminToken = await login('admin');
    const logsRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'matricula', busqueda: correlationId, pageSize: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      logsRes.body.items.some(
        (l: { entidad?: string; accion: string }) =>
          l.entidad === 'matricula_excepcional' && l.accion === 'crear',
      ),
    ).toBe(true);
  });

  it('rechaza matrícula excepcional si la edad cumple normativa', async () => {
    const token = await login('r.huanca');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/students/matricula-excepcional/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const anio = ctxRes.body.institucion.anioEscolar as number;
    const fechaNormativa = `${anio - 7}-03-31`;
    const dni = `9${Date.now().toString().slice(-7)}`;

    const ageRes = await request(app.getHttpServer())
      .post('/api/v1/students/matricula-excepcional/check-age')
      .set('Authorization', `Bearer ${token}`)
      .send({ fechaNac: fechaNormativa, gradoLabel: '2° Primaria' })
      .expect(201);

    expect(ageRes.body.cumpleEdadNormativa).toBe(true);

    return request(app.getHttpServer())
      .post('/api/v1/students/matricula-excepcional')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: 'Normativa',
        apellidos: 'Ok Test',
        dni,
        fechaNac: fechaNormativa,
        gradoLabel: '2° Primaria',
        seccion: 'A',
        excepcionalMotivo: 'Rezagado con resolución directoral',
        excepcionalSustento: 'Resolución directoral de prueba inválida',
      })
      .expect(400);
  });
});
