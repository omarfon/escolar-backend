import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Grade change audit (e2e)', () => {
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

  it('GET /grades/change-audit/context requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/v1/grades/change-audit/context')
      .expect(401);
  });

  it('GET /grades/change-audit/context responde contexto', async () => {
    const token = await login('admin');
    return request(app.getHttpServer())
      .get('/api/v1/grades/change-audit/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.institucion).toBeDefined();
        expect(res.body.permisoConsulta).toBe('evaluacion.reportes');
      });
  });

  it('GET /grades/change-audit rechaza usuario sin permiso', async () => {
    const token = await login('estudiante');
    return request(app.getHttpServer())
      .get('/api/v1/grades/change-audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('POST registry/bulk genera registro consultable en auditoría', async () => {
    const token = await login('docente');
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

    const alumno = alumnos[0];
    const compCodigo = Object.keys(alumno.componentes)[0];
    if (!compCodigo) return;

    const notaNueva = 13.5;
    await request(app.getHttpServer())
      .post('/api/v1/grades/registry/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        curso: ctx.cursoSugerido,
        bimestre: 2,
        fechaEvaluacion: '2026-06-15',
        nivel: ctx.nivel,
        grado: ctx.grado,
        seccion: ctx.seccion,
        auditMotivo: 'Prueba E2E auditoría de notas',
        entries: [
          {
            studentId: alumno.studentId,
            componenteCodigo: compCodigo,
            gradeId: alumno.componentes[compCodigo]?.gradeId,
            nota: notaNueva,
          },
        ],
      })
      .expect(201);

    const adminToken = await login('admin');
    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/grades/change-audit')
      .query({ studentId: alumno.studentId, curso: ctx.cursoSugerido })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(auditRes.body.items)).toBe(true);
    const latest = auditRes.body.items.find(
      (row: { motivo?: string; cambios?: Record<string, unknown> }) =>
        row.motivo === 'Prueba E2E auditoría de notas' ||
        row.cambios?.nota,
    );
    expect(latest).toBeDefined();
    expect(latest.resultado).toBe('success');
  });
});
