import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Password recovery (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/password-recovery/context responde contexto', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/password-recovery/context')
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.politicaPassword).toBeDefined();
      });
  });

  it('POST /auth/forgot-password valida email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'no-es-email' })
      .expect(400);
  });

  it('POST /auth/forgot-password responde genérico', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'desconocido@example.com' })
      .expect(200)
      .expect((res) => {
        expect(res.body.accepted).toBe(true);
        expect(res.body.message).toContain('Si el correo');
      });
  });

  it('POST /auth/reset-password rechaza token inválido', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'token-invalido',
        passwordNuevo: 'Clave1234',
        confirmPassword: 'Clave1234',
      })
      .expect(400);
  });

  it('POST /auth/change-password requiere autenticación', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .send({
        passwordActual: 'x',
        passwordNuevo: 'Clave1234',
        confirmPassword: 'Clave1234',
      })
      .expect(401);
  });
});
