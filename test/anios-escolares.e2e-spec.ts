import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Años escolares (e2e)', () => {
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
      .get('/api/v1/maestros/anios-escolares/context')
      .expect(401);
  });

  it('rechaza usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/maestros/anios-escolares/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('registra año escolar, evita duplicado, activa y audita', async () => {
    const token = await login('admin');
    const anio = 2031 + Math.floor(Math.random() * 50);
    const idempotencyKey = `anio-e2e-${anio}`;

    const ctx = await request(app.getHttpServer())
      .get('/api/v1/maestros/anios-escolares/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ctx.body.institucion).toBeDefined();

    const created = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio,
        fechaInicio: `${anio}-03-01`,
        fechaFin: `${anio}-12-20`,
        tipoPeriodo: 'bimestre',
        motivo: 'Registro calendarización E2E',
        idempotencyKey,
      })
      .expect(201);

    expect(created.body.anio).toBe(anio);
    expect(created.body.estado).toBe('planificado');

    const recovered = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio,
        fechaInicio: `${anio}-03-01`,
        fechaFin: `${anio}-12-20`,
        tipoPeriodo: 'bimestre',
        idempotencyKey,
      })
      .expect(201);
    expect(recovered.body.recuperado).toBe(true);
    expect(recovered.body.id).toBe(created.body.id);

    await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio,
        fechaInicio: `${anio}-03-01`,
        fechaFin: `${anio}-12-20`,
        tipoPeriodo: 'bimestre',
        idempotencyKey: `${idempotencyKey}-dup`,
      })
      .expect(409);

    const activado = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/activar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Activación E2E' })
      .expect(201);
    expect(activado.body.estado).toBe('activo');
    expect(activado.body.vigente).toBe(true);

    await new Promise((r) => setTimeout(r, 400));
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'calendarizacion', busqueda: String(anio), pageSize: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; accion: string }) =>
          l.entidad === 'anio_escolar' && l.accion === 'crear',
      ),
    ).toBe(true);
  });

  it('copia calendario del año anterior con idempotencia y auditoría', async () => {
    const token = await login('admin');
    const anioOrigen = 2080 + Math.floor(Math.random() * 20);
    const anioDestino = anioOrigen + 1;
    const copyKey = `copy-e2e-${anioDestino}`;

    const origen = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: anioOrigen,
        fechaInicio: `${anioOrigen}-03-01`,
        fechaFin: `${anioOrigen}-12-20`,
        tipoPeriodo: 'bimestre',
        generarPeriodos: true,
        motivo: 'Año origen para copia E2E',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/maestros/feriados')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anioEscolar: anioOrigen,
        fecha: `${anioOrigen}-07-28`,
        nombre: 'Feriado E2E copia',
        tipo: 'institucional',
      })
      .expect(201);

    const destino = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: anioDestino,
        fechaInicio: `${anioDestino}-03-01`,
        fechaFin: `${anioDestino}-12-20`,
        tipoPeriodo: 'bimestre',
        generarPeriodos: false,
        motivo: 'Año destino para copia E2E',
      })
      .expect(201);

    const copiado = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${destino.body.id}/copiar-calendario`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        anioOrigen,
        copiarPeriodos: true,
        copiarFeriados: true,
        copiarEventos: false,
        motivo: 'Copia calendarización E2E',
        idempotencyKey: copyKey,
      })
      .expect(201);

    expect(copiado.body.anioOrigen).toBe(anioOrigen);
    expect(copiado.body.anioDestino).toBe(anioDestino);
    expect(copiado.body.periodos.copiados).toBeGreaterThan(0);
    expect(copiado.body.feriados.copiados).toBeGreaterThan(0);

    const periodosDestino = await request(app.getHttpServer())
      .get('/api/v1/maestros/periodos-academicos')
      .query({ anioEscolar: anioDestino })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(periodosDestino.body.length).toBeGreaterThan(0);

    const feriadosDestino = await request(app.getHttpServer())
      .get('/api/v1/maestros/feriados')
      .query({ anioEscolar: anioDestino })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      feriadosDestino.body.some((f: { fecha: string }) => f.fecha === `${anioDestino}-07-28`),
    ).toBe(true);

    const recuperado = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${destino.body.id}/copiar-calendario`)
      .set('Authorization', `Bearer ${token}`)
      .send({ anioOrigen, idempotencyKey: copyKey })
      .expect(201);
    expect(recuperado.body.recuperado).toBe(true);

    const tokenPadre = await login('p.vargas');
    await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${destino.body.id}/copiar-calendario`)
      .set('Authorization', `Bearer ${tokenPadre}`)
      .send({ anioOrigen })
      .expect(403);

    await new Promise((r) => setTimeout(r, 400));
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'calendarizacion', busqueda: String(anioDestino), pageSize: 20 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; descripcion?: string }) =>
          l.entidad === 'anio_escolar' && l.descripcion?.includes('Calendario copiado'),
      ),
    ).toBe(true);
  });

  it('dividir año en periodos y rechazar sin permiso', async () => {
    const token = await login('admin');
    const anio = 2095 + Math.floor(Math.random() * 20);

    const created = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio,
        fechaInicio: `${anio}-03-01`,
        fechaFin: `${anio}-12-20`,
        tipoPeriodo: 'trimestre',
        generarPeriodos: false,
        motivo: 'Año sin periodos para dividir E2E',
      })
      .expect(201);

    const dividido = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/dividir-periodos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'trimestre', motivo: 'División E2E' })
      .expect(201);

    expect(dividido.body.tipo).toBe('trimestre');
    expect(dividido.body.periodos.length).toBe(3);

    const periodos = await request(app.getHttpServer())
      .get('/api/v1/maestros/periodos-academicos')
      .query({ anioEscolar: anio })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(periodos.body.length).toBe(3);

    const tokenPadre = await login('p.vargas');
    await request(app.getHttpServer())
      .post('/api/v1/maestros/periodos-academicos/dividir')
      .set('Authorization', `Bearer ${tokenPadre}`)
      .send({ anioEscolar: anio, tipo: 'bimestre' })
      .expect(403);
  });

  it('publica comunicado del calendario con idempotencia y audita', async () => {
    const token = await login('admin');
    const anio = 2110 + Math.floor(Math.random() * 20);
    const pubKey = `pub-comunicado-e2e-${anio}`;

    const created = await request(app.getHttpServer())
      .post('/api/v1/maestros/anios-escolares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio,
        fechaInicio: `${anio}-03-01`,
        fechaFin: `${anio}-12-20`,
        tipoPeriodo: 'bimestre',
        generarPeriodos: false,
        motivo: 'Año para publicar comunicado E2E',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/dividir-periodos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'bimestre', motivo: 'Periodos para publicación E2E' })
      .expect(201);

    const publicado = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/publicar-comunicado`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinatarios: 'todos',
        prioridad: 'media',
        motivo: 'Publicación oficial del calendario E2E',
        idempotencyKey: pubKey,
      })
      .expect(201);

    expect(publicado.body.comunicado.id).toBeDefined();
    expect(publicado.body.anioEscolar.publicado).toBe(true);
    expect(publicado.body.version).toBeGreaterThan(1);

    const recuperado = await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/publicar-comunicado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: pubKey })
      .expect(201);
    expect(recuperado.body.recuperado).toBe(true);

    const tokenPadre = await login('p.vargas');
    await request(app.getHttpServer())
      .post(`/api/v1/maestros/anios-escolares/${created.body.id}/publicar-comunicado`)
      .set('Authorization', `Bearer ${tokenPadre}`)
      .send({ destinatarios: 'todos' })
      .expect(403);

    const detalle = await request(app.getHttpServer())
      .get(`/api/v1/maestros/anios-escolares/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      detalle.body.eventos.some(
        (e: { accion: string }) => e.accion === 'publicar_comunicado',
      ),
    ).toBe(true);
  });
});
