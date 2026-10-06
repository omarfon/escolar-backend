import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const ESTADOS_TRASLADO_ACTIVOS = ['borrador', 'enviada', 'observada', 'aprobada'];

async function pickStudentForTransfer(
  app: INestApplication<App>,
  token: string,
  destinoModular: string,
): Promise<{ id: number; dni?: string }> {
  const students = await request(app.getHttpServer())
    .get('/api/v1/students')
    .query({ estado: 'activo', pageSize: 50 })
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const list = students.body.items as Array<{ id: number; dni?: string }>;
  const transfers = await request(app.getHttpServer())
    .get('/api/v1/transfer-requests')
    .query({ pageSize: 50 })
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const ocupados = new Set(
    (transfers.body.items as Array<{ studentId: number; ieDestinoCodigoModular: string; estado: string }>)
      .filter(
        (t) =>
          t.ieDestinoCodigoModular === destinoModular &&
          ESTADOS_TRASLADO_ACTIVOS.includes(t.estado),
      )
      .map((t) => t.studentId),
  );
  const picked = list.find((s) => s.dni && !ocupados.has(s.id));
  expect(picked).toBeDefined();
  return picked!;
}

describe('Solicitud de traslado IE origen (e2e)', () => {
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

  it('exige autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/transfer-requests/context')
      .expect(401);
  });

  it('rechaza a un usuario sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('crea, evita duplicado, envía, bloquea transición inválida y audita', async () => {
    const token = await login('r.huanca');
    const ctx = await request(app.getHttpServer())
      .get('/api/v1/transfer-requests/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const origen = ctx.body.institucion.codigoModular as string;

    const modular = origen === '7654321' ? '1234567' : '7654321';
    const student = await pickStudentForTransfer(app, token, modular);
    const plazo = new Date();
    plazo.setDate(plazo.getDate() + 20);
    const plazoHasta = plazo.toISOString().slice(0, 10);
    const correlationId = `traslado-e2e-${Date.now()}`;
    const payload = {
      studentId: student!.id,
      ieDestinoNombre: 'I.E. Francisco Bolognesi',
      ieDestinoCodigoModular: modular,
      ieDestinoUgel: 'UGEL 04 Lima',
      ieDestinoDre: 'DRE Lima Metropolitana',
      motivo: 'Cambio de domicilio familiar documentado',
      plazoHasta,
      evidenciaTipo: 'referencia',
      evidenciaReferencia: 'Resolución de traslado E2E',
      idempotencyKey: correlationId,
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .send(payload)
      .expect(201);

    expect(created.body.estado).toBe('borrador');
    expect(created.body.codigo).toMatch(/^TR-\d{4}-\d{4}$/);
    expect(created.body.recuperada).toBe(false);

    const recovered = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    expect(recovered.body.recuperada).toBe(true);
    expect(recovered.body.id).toBe(created.body.id);

    await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, idempotencyKey: `${correlationId}-dup` })
      .expect(409);

    const enviada = await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accion: 'enviar' })
      .expect(201);
    expect(enviada.body.estado).toBe('enviada');
    expect(enviada.body.notificaciones.some((n: { ambito: string }) => n.ambito === 'UGEL')).toBe(true);
    expect(
      enviada.body.notificaciones.every(
        (n: { estadoEntrega: string; plantilla: string }) =>
          n.estadoEntrega === 'entregado' && !!n.plantilla,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accion: 'enviar' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accion: 'aprobar', motivo: 'Intento de aprobación desde la IE de origen' })
      .expect(403);

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/enrollment-history/${student!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const eventosTraslado = historial.body.eventosMatricula.filter(
      (e: { tipo: string; metadata?: { codigo?: string } }) => e.tipo === 'traslado',
    );
    expect(
      eventosTraslado.some((e) => e.metadata?.codigo === created.body.codigo),
    ).toBe(true);
    expect(eventosTraslado.some((e) => e.metadata?.accion === 'enviar')).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accion: 'cancelar', motivo: 'Prueba E2E cancelada' })
      .expect(201);

    await new Promise((r) => setTimeout(r, 400));
    const admin = await login('admin');
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'traslados', busqueda: correlationId, pageSize: 10 })
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; accion: string }) =>
          l.entidad === 'solicitud_traslado' && l.accion === 'crear',
      ),
    ).toBe(true);
  });
});

describe('Aprobación del traslado IE destino (e2e)', () => {
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

  it('permite aprobar desde la IE destino, audita y bloquea la IE origen', async () => {
    const origenToken = await login('r.huanca');
    const destinoToken = await login('m.destino');

    const student = await pickStudentForTransfer(app, origenToken, '7654321');

    const plazo = new Date();
    plazo.setDate(plazo.getDate() + 25);
    const correlationId = `traslado-destino-e2e-${Date.now()}`;
    const payload = {
      studentId: student!.id,
      ieDestinoNombre: 'I.E. Francisco Bolognesi',
      ieDestinoCodigoModular: '7654321',
      ieDestinoUgel: 'UGEL 04 Lima',
      ieDestinoDre: 'DRE Lima Metropolitana',
      motivo: 'Cambio de domicilio hacia la IE de destino',
      plazoHasta: plazo.toISOString().slice(0, 10),
      evidenciaTipo: 'referencia',
      evidenciaReferencia: 'Resolución de traslado destino E2E',
      idempotencyKey: correlationId,
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${origenToken}`)
      .set('x-correlation-id', correlationId)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'enviar' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'aprobar', motivo: 'Intento de aprobación desde la IE de origen' })
      .expect(403);

    const aprobada = await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({ accion: 'aprobar', motivo: 'Vacante disponible y documentación conforme' })
      .expect(201);

    expect(aprobada.body.estado).toBe('aprobada');
    expect(
      aprobada.body.notificaciones.some(
        (n: { ambito: string; mensaje: string; plantilla: string }) =>
          n.ambito === 'IE_ORIGEN' &&
          n.plantilla === 'traslado_aprobado_origen' &&
          n.mensaje.includes('aprobado'),
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({ accion: 'aprobar' })
      .expect(400);

    await new Promise((r) => setTimeout(r, 400));
    const admin = await login('admin');
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'traslados', busqueda: created.body.codigo, pageSize: 10 })
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; accion: string }) =>
          l.entidad === 'solicitud_traslado' && l.accion === 'aprobar',
      ),
    ).toBe(true);
  });

  it('rechaza a un usuario sin permiso de aprobación en destino', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

describe('Registro del motivo (e2e)', () => {
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

  it('registra motivo en solicitud enviada, evita duplicado y audita', async () => {
    const origenToken = await login('r.huanca');
    const destinoToken = await login('m.destino');
    const student = await pickStudentForTransfer(app, origenToken, '7654321');
    const plazo = new Date();
    plazo.setDate(plazo.getDate() + 30);
    const correlationId = `traslado-motivo-e2e-${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${origenToken}`)
      .send({
        studentId: student!.id,
        ieDestinoNombre: 'I.E. Francisco Bolognesi',
        ieDestinoCodigoModular: '7654321',
        ieDestinoUgel: 'UGEL 04 Lima',
        ieDestinoDre: 'DRE Lima Metropolitana',
        motivo: 'Cambio de domicilio documentado para prueba de motivo',
        plazoHasta: plazo.toISOString().slice(0, 10),
        evidenciaTipo: 'referencia',
        evidenciaReferencia: 'Resolución E2E motivo',
        idempotencyKey: correlationId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'enviar' })
      .expect(201);

    const motivoKey = `motivo-${correlationId}`;
    const registrado = await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/motivo`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({
        motivo: 'Falta adjuntar constancia de vacante en la IE destino',
        observacion: 'Completar documentación antes del plazo',
        idempotencyKey: motivoKey,
      })
      .expect(201);

    expect(registrado.body.estado).toBe('enviada');
    expect(registrado.body.observacion).toContain('Completar documentación');
    expect(
      registrado.body.eventos.some(
        (e: { accion: string; motivo: string }) =>
          e.accion === 'registrar_motivo' &&
          e.motivo.includes('constancia de vacante'),
      ),
    ).toBe(true);

    const recuperado = await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/motivo`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({
        motivo: 'Falta adjuntar constancia de vacante en la IE destino',
        idempotencyKey: motivoKey,
      })
      .expect(201);
    expect(recuperado.body.recuperada).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/motivo`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({ motivo: 'abc' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({ accion: 'aprobar' })
      .expect(400);

    await new Promise((r) => setTimeout(r, 400));
    const admin = await login('admin');
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'traslados', busqueda: created.body.codigo, pageSize: 15 })
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; accion: string; detalle?: { motivo?: string } }) =>
          l.entidad === 'solicitud_traslado' &&
          l.accion === 'actualizar' &&
          l.detalle?.motivo?.includes('constancia'),
      ),
    ).toBe(true);
  });

  it('rechaza registro de motivo sin permiso ni ámbito válido', async () => {
    const origenToken = await login('r.huanca');
    const student = await pickStudentForTransfer(app, origenToken, '7654321');
    const plazo = new Date();
    plazo.setDate(plazo.getDate() + 30);

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${origenToken}`)
      .send({
        studentId: student!.id,
        ieDestinoNombre: 'I.E. Francisco Bolognesi',
        ieDestinoCodigoModular: '7654321',
        ieDestinoUgel: 'UGEL 04 Lima',
        ieDestinoDre: 'DRE Lima Metropolitana',
        motivo: 'Solicitud para probar permiso de registro de motivo',
        plazoHasta: plazo.toISOString().slice(0, 10),
        evidenciaTipo: 'referencia',
        evidenciaReferencia: 'Resolución E2E permiso motivo',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'enviar' })
      .expect(201);

    const directorToken = await login('director');
    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/motivo`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ motivo: 'Intento de registro desde IE ajena al traslado' })
      .expect(403);
  });
});

describe('Notificación de estados (e2e)', () => {
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

  it('lista notificaciones, marca leída, evita duplicados y audita', async () => {
    const origenToken = await login('r.huanca');
    const destinoToken = await login('m.destino');
    const student = await pickStudentForTransfer(app, origenToken, '7654321');
    const correlationId = `traslado-notif-e2e-${Date.now()}`;
    const plazo = new Date();
    plazo.setDate(plazo.getDate() + 28);

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${origenToken}`)
      .send({
        studentId: student!.id,
        ieDestinoNombre: 'I.E. Francisco Bolognesi',
        ieDestinoCodigoModular: '7654321',
        ieDestinoUgel: 'UGEL 04 Lima',
        ieDestinoDre: 'DRE Lima Metropolitana',
        motivo: 'Cambio de domicilio para prueba de notificaciones',
        plazoHasta: plazo.toISOString().slice(0, 10),
        evidenciaTipo: 'referencia',
        evidenciaReferencia: 'Resolución E2E notificaciones',
        idempotencyKey: correlationId,
      })
      .expect(201);

    const enviada = await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'enviar' })
      .expect(201);

    const countInicial = enviada.body.notificaciones.length;
    expect(countInicial).toBeGreaterThanOrEqual(3);

    const listado = await request(app.getHttpServer())
      .get(`/api/v1/transfer-requests/${created.body.id}/notifications`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .expect(200);
    expect(listado.body.total).toBe(countInicial);
    expect(
      listado.body.items.every(
        (n: { estadoEntrega: string; plantilla: string }) =>
          n.estadoEntrega === 'entregado' && !!n.plantilla,
      ),
    ).toBe(true);

    const destinoNotif = listado.body.items.find(
      (n: { ambito: string }) => n.ambito === 'IE_DESTINO',
    );
    expect(destinoNotif).toBeDefined();

    const leida = await request(app.getHttpServer())
      .patch(
        `/api/v1/transfer-requests/${created.body.id}/notifications/${destinoNotif.id}/read`,
      )
      .set('Authorization', `Bearer ${destinoToken}`)
      .expect(200);
    expect(leida.body.leida).toBe(true);
    expect(leida.body.leidoAt).toBeDefined();

    await request(app.getHttpServer())
      .patch(
        `/api/v1/transfer-requests/${created.body.id}/notifications/${destinoNotif.id}/read`,
      )
      .set('Authorization', `Bearer ${origenToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/notifications/retry`)
      .set('Authorization', `Bearer ${destinoToken}`)
      .send({})
      .expect(404);

    await new Promise((r) => setTimeout(r, 400));
    const admin = await login('admin');
    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ modulo: 'traslados', busqueda: created.body.codigo, pageSize: 20 })
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      logs.body.items.some(
        (l: { entidad?: string; descripcion?: string }) =>
          l.entidad === 'notificacion_traslado' &&
          l.descripcion?.includes('leída'),
      ),
    ).toBe(true);
  });

  it('rechaza listado sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/transfer-requests/1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('expone seguimiento consolidado del proceso', async () => {
    const origenToken = await login('admin');
    const student = await pickStudentForTransfer(app, origenToken, '87654321');
    const plazo = new Date();
    plazo.setMonth(plazo.getMonth() + 2);

    const created = await request(app.getHttpServer())
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${origenToken}`)
      .send({
        studentId: student.id,
        ieDestinoNombre: 'IE Destino Seguimiento',
        ieDestinoCodigoModular: '87654321',
        ieDestinoUgel: 'UGEL 02',
        ieDestinoDre: 'DRE Lima',
        motivo: 'Seguimiento E2E del proceso de traslado',
        plazoHasta: plazo.toISOString().slice(0, 10),
        evidenciaTipo: 'referencia',
        evidenciaReferencia: 'Resolución E2E seguimiento',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/transfer-requests/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${origenToken}`)
      .send({ accion: 'enviar' })
      .expect(201);

    const seguimiento = await request(app.getHttpServer())
      .get(`/api/v1/transfer-requests/${created.body.id}/seguimiento`)
      .set('Authorization', `Bearer ${origenToken}`)
      .expect(200);

    expect(seguimiento.body.solicitud.codigo).toBe(created.body.codigo);
    expect(seguimiento.body.etapas).toHaveLength(5);
    expect(seguimiento.body.lineaTiempo.length).toBeGreaterThanOrEqual(2);
    expect(seguimiento.body.resumen.estadoActual).toBe('enviada');
    expect(seguimiento.body.solicitud.rolVisualizador).toBeDefined();
  });

  it('rechaza seguimiento sin permiso', async () => {
    const token = await login('p.vargas');
    return request(app.getHttpServer())
      .get('/api/v1/transfer-requests/1/seguimiento')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
