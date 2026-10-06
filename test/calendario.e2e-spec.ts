import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Calendario escolar (e2e)', () => {
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
  }, 90_000);

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

  it('exige autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/maestros/calendario/context')
      .expect(401);
  });

  it('rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/maestros/calendario/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('devuelve contexto y calendario agregado para admin', async () => {
    const token = await login('admin');

    const ctx = await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ctx.body.institucion).toBeDefined();
    expect(ctx.body.rolVista).toBeDefined();
    expect(ctx.body.rolVistaLabel).toBeDefined();

    const cal = await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: '2026-06' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cal.body.contexto.mes).toBe('2026-06');
    expect(Array.isArray(cal.body.dias)).toBe(true);
    expect(cal.body.dias.length).toBeGreaterThan(0);
    expect(cal.body.resumen).toBeDefined();
    expect(Array.isArray(cal.body.periodos)).toBe(true);
    expect(Array.isArray(cal.body.feriados)).toBe(true);
    expect(Array.isArray(cal.body.eventos)).toBe(true);
  });

  it('rechaza mes con formato inválido', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: 'junio-2026' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('docente consulta calendario filtrado por rol', async () => {
    const token = await login('docente');
    const cal = await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: '2026-06' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cal.body.contexto.rolVista).toBe('docente');
    expect(Array.isArray(cal.body.dias)).toBe(true);
  });

  it('padre consulta calendario filtrado por rol', async () => {
    const token = await login('padre');
    const cal = await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: '2026-06' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cal.body.contexto.rolVista).toBe('padre');
    expect(Array.isArray(cal.body.dias)).toBe(true);
  });

  it('estudiante consulta calendario con rol alumno', async () => {
    const token = await login('estudiante');
    const cal = await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: '2026-06' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cal.body.contexto.rolVista).toBe('alumno');
    expect(Array.isArray(cal.body.eventos)).toBe(true);
  });

  it('admin ve al menos tantos eventos como roles de portal en junio', async () => {
    const adminToken = await login('admin');
    const docenteToken = await login('docente');
    const padreToken = await login('padre');
    const estudianteToken = await login('estudiante');

    const consultar = async (token: string) => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/maestros/calendario')
        .query({ mes: '2026-06' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return res.body as {
        contexto: { rolVista: string };
        eventos: Array<{ titulo: string; destinatarios: string }>;
      };
    };

    const adminCal = await consultar(adminToken);
    const docenteCal = await consultar(docenteToken);
    const padreCal = await consultar(padreToken);
    const alumnoCal = await consultar(estudianteToken);

    expect(adminCal.contexto.rolVista).toBe('gestion_ie');
    expect(docenteCal.contexto.rolVista).toBe('docente');
    expect(padreCal.contexto.rolVista).toBe('padre');
    expect(alumnoCal.contexto.rolVista).toBe('alumno');

    expect(adminCal.eventos.length).toBeGreaterThanOrEqual(docenteCal.eventos.length);
    expect(adminCal.eventos.length).toBeGreaterThanOrEqual(padreCal.eventos.length);
    expect(adminCal.eventos.length).toBeGreaterThanOrEqual(alumnoCal.eventos.length);

    const eventoDocente = adminCal.eventos.find((e) => e.destinatarios === 'docentes');
    const eventoPadre = adminCal.eventos.find((e) => e.destinatarios === 'padres');
    if (eventoDocente) {
      expect(docenteCal.eventos.some((e) => e.titulo === eventoDocente.titulo)).toBe(true);
    }
    if (eventoPadre) {
      expect(padreCal.eventos.some((e) => e.titulo === eventoPadre.titulo)).toBe(true);
    }
  });

  it('registra auditoría de consulta', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .get('/api/v1/maestros/calendario')
      .query({ mes: '2026-06' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await new Promise((r) => setTimeout(r, 500));

    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'calendarizacion', entidad: 'calendario', accion: 'consultar' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const page = audit.body;
    const total = page.pagination?.totalItems ?? page.items?.length ?? 0;
    expect(total).toBeGreaterThan(0);
  });
});
