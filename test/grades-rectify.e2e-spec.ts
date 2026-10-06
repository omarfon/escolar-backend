import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Rectificación de notas (e2e)', () => {
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

  it('GET /grades/registry/rectify/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/grades/registry/rectify/context')
      .expect(401);
  });

  it('GET /grades/registry/rectify/context responde contexto para admin', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/grades/registry/rectify/context?bimestre=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.permisos).toBeDefined();
        expect(res.body.permisos.rectificar).toBe(true);
        expect(Array.isArray(res.body.contexts)).toBe(true);
      });
  });

  it('POST /grades/registry/rectify rechaza docente sin permiso', async () => {
    const token = await login('docente');
    await request(app.getHttpServer())
      .post('/api/v1/grades/registry/rectify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        curso: 'Matemática',
        bimestre: 2,
        fechaEvaluacion: '2026-06-15',
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        motivo: 'Motivo de prueba E2E rectificación',
        entries: [{ studentId: 1, componenteCodigo: 'EXAMEN', nota: 15 }],
      })
      .expect(403);
  });

  it('POST /grades/registry/rectify rechaza motivo corto', async () => {
    const token = await login('admin');
    await request(app.getHttpServer())
      .post('/api/v1/grades/registry/rectify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        curso: 'Matemática',
        bimestre: 2,
        fechaEvaluacion: '2026-06-15',
        nivel: 'Primaria',
        grado: '4°',
        seccion: 'A',
        motivo: 'corto',
        entries: [{ studentId: 1, componenteCodigo: 'EXAMEN', nota: 15 }],
      })
      .expect(400);
  });

  it('POST /grades/registry/rectify registra auditoría con acción rectificar', async () => {
    const token = await login('admin');
    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/grades/registry/contexts?bimestre=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const contexts = ctxRes.body.contexts as Array<{
      nivel: string;
      grado: string;
      seccion: string;
      cursoSugerido: string;
    }>;
    if (!contexts?.length) return;

    const ctx = contexts[0];
    const regRes = await request(app.getHttpServer())
      .get('/api/v1/grades/registry')
      .query({
        nivel: ctx.nivel,
        grado: ctx.grado,
        seccion: ctx.seccion,
        curso: ctx.cursoSugerido,
        bimestre: 2,
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const alumnos = regRes.body.alumnos as Array<{
      studentId: number;
      componentes: Record<string, { gradeId?: number; nota: number | null }>;
    }>;
    if (!alumnos?.length) return;

    const alumno = alumnos.find((a) =>
      Object.values(a.componentes).some((c) => c.gradeId && c.nota !== null),
    );
    if (!alumno) return;

    const compEntry = Object.entries(alumno.componentes).find(
      ([, c]) => c.gradeId && c.nota !== null,
    );
    if (!compEntry) return;

    const [compCodigo, cell] = compEntry;
    const notaNueva = cell.nota === 18 ? 17.5 : 18;

    await request(app.getHttpServer())
      .post('/api/v1/grades/registry/rectify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        curso: ctx.cursoSugerido,
        bimestre: 2,
        fechaEvaluacion: '2026-06-15',
        nivel: ctx.nivel,
        grado: ctx.grado,
        seccion: ctx.seccion,
        motivo: 'Rectificación E2E: corrección por error de digitación',
        entries: [
          {
            studentId: alumno.studentId,
            componenteCodigo: compCodigo,
            gradeId: cell.gradeId,
            nota: notaNueva,
          },
        ],
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
        expect(r.body.saved).toBeGreaterThanOrEqual(1);
      });

    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/grades/change-audit')
      .query({
        accion: 'rectificar',
        curso: ctx.cursoSugerido,
        bimestre: 2,
        pageSize: 5,
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const items = auditRes.body.items as Array<{ accion: string; motivo: string }>;
    expect(items.some((i) => i.accion === 'rectificar')).toBe(true);
    expect(items.some((i) => i.motivo.includes('Rectificación E2E'))).toBe(true);
  });
});
