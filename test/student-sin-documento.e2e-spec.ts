import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Student sin documento (e2e)', () => {
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

  it('GET /students/sin-documento/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/sin-documento/context')
      .expect(401);
  });

  it('POST /students/sin-documento rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .post('/api/v1/students/sin-documento')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: 'Test',
        apellidos: 'Sin Doc',
        fechaNac: '2015-01-01',
        gradoLabel: '1° Primaria',
        seccion: 'A',
        sinDocumentoMotivo: 'Extranjero recién llegado',
        sinDocumentoSustento: 'Constancia migraciones',
      })
      .expect(403);
  });

  it('POST /students/sin-documento registra estudiante pendiente de regularización', async () => {
    const token = await login('r.huanca');
    const marker = `SinDoc${Date.now().toString().slice(-6)}`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/students/sin-documento')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: marker,
        apellidos: 'Apellido Test',
        fechaNac: '2014-06-15',
        sexo: 'F',
        gradoLabel: '2° Primaria',
        seccion: 'B',
        sinDocumentoMotivo: 'Registro excepcional sin DNI',
        sinDocumentoSustento: 'Informe de admisión provisional',
        confirmarDuplicado: true,
      })
      .expect(201);

    expect(res.body.estadoDocumento).toBe('pendiente_regularizacion');
    expect(res.body.tipoDocumento).toBe('SIN_DOC');
    expect(res.body.codigo).toBeDefined();
    expect(res.body.dni).toBe('');

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${res.body.id}/change-audit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(auditRes.body.items.some((i: { accion: string }) => i.accion === 'crear')).toBe(
      true,
    );
  });

  it('PATCH regularizar-documento asocia DNI sin crear otro estudiante', async () => {
    const token = await login('r.huanca');
    const marker = `Reg${Date.now().toString().slice(-6)}`;

    const created = await request(app.getHttpServer())
      .post('/api/v1/students/sin-documento')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombres: marker,
        apellidos: 'Regularizar',
        fechaNac: '2013-03-20',
        sexo: 'M',
        gradoLabel: '3° Primaria',
        seccion: 'A',
        sinDocumentoMotivo: 'Prueba regularización',
        sinDocumentoSustento: 'Acta interna',
        confirmarDuplicado: true,
      })
      .expect(201);

    const dni = `9${Date.now().toString().slice(-7)}`;
    const reg = await request(app.getHttpServer())
      .patch(`/api/v1/students/${created.body.id}/regularizar-documento`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dni,
        tipoDocumento: 'DNI',
        auditMotivo: 'Presentó DNI en secretaría',
      })
      .expect(200);

    expect(reg.body.estadoDocumento).toBe('regular');
    expect(reg.body.dni).toBe(dni);
    expect(reg.body.tipoDocumento).toBe('DNI');
    expect(reg.body.id).toBe(created.body.id);
  });
});
