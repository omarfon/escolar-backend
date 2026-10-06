import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Request } from 'express';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { Institution } from '../institution/entities/institution.entity';
import {
  getClientIp,
  getCorrelationId,
  parseActorFromRequest,
} from '../audit-logs/audit-context.util';
import { gradosCoinciden } from '../competency-evaluations/competency-evaluations.util';
import { GradingConfigService } from '../grading/grading-config.service';
import {
  assertNotaInRange,
  boundsFromConfig,
  buildRangeValidationContext,
  RangeValidationContext,
} from '../grading/grading-range.util';
import { CursosMaestrosService } from '../maestros/cursos/cursos.service';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { StudentsService } from '../students/students.service';
import {
  dedupeStudentsByPerson,
  isStudentMatriculaActiva,
  listStudentsForAula,
  matchesStudentSection,
} from '../students/students-dedupe.util';
import {
  DIAGNOSTIC_BIMESTRE,
  isNivelLogroDiagnostico,
  NivelLogroDiagnostico,
} from './diagnostic-evaluations.constants';
import {
  DiagnosticAuditContext,
  DiagnosticChangeAuditService,
} from './diagnostic-change-audit.service';
import { SaveDiagnosticEvaluationsBulkDto } from './dto/diagnostic-evaluation.dto';
import { DiagnosticEvaluation } from './entities/diagnostic-evaluation.entity';

export interface DiagnosticContextCurso {
  nombre: string;
  conEvaluaciones: boolean;
}

export interface DiagnosticContextItem {
  id: string;
  nivel: string;
  grado: string;
  seccion: string;
  label: string;
  alumnosCount: number;
  cursos: DiagnosticContextCurso[];
  cursoSugerido: string;
  actaCerrada: boolean;
}

export interface DiagnosticRegistryContextResponse {
  bimestre: number;
  bimestreActual: number;
  anioEscolar: number;
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    ugel: string;
    dre: string;
  } | null;
  permisos: { consultar: boolean; registrar: boolean };
  modoRegistro: 'numerico' | 'competencia' | 'mixto';
  contexts: DiagnosticContextItem[];
}

export interface DiagnosticAlumnoRow {
  studentId: number;
  nombre: string;
  apellido: string;
  codigo: string;
  evaluationId?: number;
  nota: number | null;
  nivelLogro: NivelLogroDiagnostico | null;
  nivelDerivado: string | null;
  observacion: string | null;
}

export interface DiagnosticRegistryResponse {
  bimestre: number;
  bimestreActual: number;
  bimestreHabilitado: boolean;
  anioEscolar: number;
  curso: string;
  nivel: string;
  grado: string;
  seccion: string;
  modoRegistro: 'numerico' | 'competencia' | 'mixto';
  validacionRangos?: RangeValidationContext;
  alumnos: DiagnosticAlumnoRow[];
  actaCerrada: boolean;
  edicionBloqueada: boolean;
}

@Injectable()
export class DiagnosticEvaluationsService {
  constructor(
    @InjectRepository(DiagnosticEvaluation)
    private readonly evalRepo: Repository<DiagnosticEvaluation>,
    @InjectRepository(EvaluationActa)
    private readonly actaRepo: Repository<EvaluationActa>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly studentsService: StudentsService,
    private readonly cursosService: CursosMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly gradingConfigService: GradingConfigService,
    private readonly changeAudit: DiagnosticChangeAuditService,
  ) {}

  async getRegistryContext(
    user?: RequestUser,
    institutionId?: number,
  ): Promise<DiagnosticRegistryContextResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const config = await this.gradingConfigService.getConfigForInstitution(
      institutionId,
    );
    const modoRegistro = this.resolveModoRegistro(config);

    let institution = institutionId
      ? await this.institutionRepo.findOneBy({ id: institutionId })
      : await this.institutionRepo.findOne({ where: {}, order: { id: 'ASC' } });

    const students = await this.studentsService.findAll(institutionId);
    const activos = students.filter((s) => isStudentMatriculaActiva(s));
    const cursosMaestros = await this.cursosService.findAll({
      activo: true,
    });

    const evaluations = await this.evalRepo.find({
      where: {
        bimestre: DIAGNOSTIC_BIMESTRE,
        anio: anioEscolar,
        ...(institutionId === undefined ? {} : { institutionId }),
      },
    });

    const groups = new Map<
      string,
      { nivel: string; grado: string; seccion: string; studentIds: number[] }
    >();
    const processedKeys = new Set<string>();

    for (const student of activos) {
      const seccion = student.seccion.trim().toUpperCase();
      const gradoNorm = normalizeGradoMatricula(student.grado);
      const key = `${student.nivel}|${gradoNorm}|${seccion}`;
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const personas = dedupeStudentsByPerson(
        activos.filter(
          (s) =>
            s.nivel.trim() === student.nivel.trim() &&
            normalizeGradoMatricula(s.grado) === gradoNorm &&
            matchesStudentSection(s, seccion),
        ),
      );
      groups.set(key, {
        nivel: student.nivel,
        grado: gradoNorm,
        seccion,
        studentIds: personas.map((s) => s.id),
      });
    }

    const contexts: DiagnosticContextItem[] = [];

    for (const group of groups.values()) {
      const studentSet = new Set(group.studentIds);
      const evalsSection = evaluations.filter((e) =>
        studentSet.has(e.studentId),
      );

      const catalog = cursosMaestros
        .filter(
          (c) =>
            c.nivel === group.nivel &&
            (c.grados ?? []).some((g) =>
              gradosCoinciden(group.nivel, g, group.grado),
            ),
        )
        .map((c) => c.nombre);

      const fromEvals = [
        ...new Set(evalsSection.map((e) => e.curso).filter(Boolean)),
      ];
      const nombres = [...new Set([...catalog, ...fromEvals])].sort((a, b) =>
        a.localeCompare(b, 'es'),
      );

      const cursosConEval = new Set(evalsSection.map((e) => e.curso));
      const cursos: DiagnosticContextCurso[] = nombres.map((nombre) => ({
        nombre,
        conEvaluaciones: cursosConEval.has(nombre),
      }));

      const cursoSugerido =
        cursos.find((c) => c.conEvaluaciones)?.nombre ??
        cursos.find((c) => c.nombre === 'Comunicación')?.nombre ??
        cursos[0]?.nombre ??
        '';

      const actaCerrada = await this.isActaCerrada(
        group.nivel,
        group.grado,
        group.seccion,
      );

      contexts.push({
        id: `${group.nivel}|${group.grado}|${group.seccion}`,
        nivel: group.nivel,
        grado: group.grado,
        seccion: group.seccion,
        label: `${group.nivel} · ${group.grado} · ${group.seccion}`,
        alumnosCount: group.studentIds.length,
        cursos,
        cursoSugerido,
        actaCerrada,
      });
    }

    return {
      bimestre: DIAGNOSTIC_BIMESTRE,
      bimestreActual,
      anioEscolar,
      institucion: institution
        ? {
            id: institution.id,
            nombre: institution.nombre,
            siglas: institution.siglas,
            ugel: institution.ugel,
            dre: institution.dre,
          }
        : null,
      permisos: {
        consultar: !!user?.permisos?.includes('evaluacion.ver'),
        registrar:
          !!user?.permisos?.includes('evaluacion.registrar') ||
          !!user?.permisos?.includes('evaluacion.editar'),
      },
      modoRegistro,
      contexts: contexts.sort((a, b) => {
        const byNivel = a.nivel.localeCompare(b.nivel, 'es');
        if (byNivel !== 0) return byNivel;
        const byGrado = a.grado.localeCompare(b.grado, 'es', { numeric: true });
        if (byGrado !== 0) return byGrado;
        return a.seccion.localeCompare(b.seccion, 'es');
      }),
    };
  }

  async getRegistry(query: {
    nivel: string;
    grado: string;
    seccion: string;
    curso: string;
    institutionId?: number;
  }): Promise<DiagnosticRegistryResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const config = await this.gradingConfigService.getConfigForInstitution(
      query.institutionId,
    );
    const modoRegistro = this.resolveModoRegistro(config);
    const validacionRangos = buildRangeValidationContext(config);

    const students = await this.studentsService.findAll(query.institutionId);
    const filtered = listStudentsForAula(
      students,
      query.nivel,
      query.grado,
      query.seccion,
    );

    const evaluations =
      bimestreActual >= DIAGNOSTIC_BIMESTRE
        ? await this.evalRepo.find({
            where: {
              curso: query.curso,
              bimestre: DIAGNOSTIC_BIMESTRE,
              anio: anioEscolar,
              ...(query.institutionId === undefined
                ? {}
                : { institutionId: query.institutionId }),
            },
          })
        : [];

    const evalByStudent = new Map(
      evaluations.map((e) => [e.studentId, e]),
    );

    const alumnos: DiagnosticAlumnoRow[] = filtered.map((student) => {
      const match = evalByStudent.get(student.id);
      const nota = match?.nota ?? null;
      return {
        studentId: student.id,
        nombre: student.nombre,
        apellido: student.apellido,
        codigo: student.codigo || `2026-${String(student.id).padStart(3, '0')}`,
        evaluationId: match?.id,
        nota,
        nivelLogro: (match?.nivelLogro as NivelLogroDiagnostico | null) ?? null,
        nivelDerivado:
          nota !== null
            ? this.gradingConfigService.nivelFromNota(nota, config.escalaLogro)
            : null,
        observacion: match?.observacion ?? null,
      };
    });

    const actaCerrada = await this.isActaCerrada(
      query.nivel,
      query.grado,
      query.seccion,
    );

    return {
      bimestre: DIAGNOSTIC_BIMESTRE,
      bimestreActual,
      bimestreHabilitado: DIAGNOSTIC_BIMESTRE <= bimestreActual,
      anioEscolar,
      curso: query.curso,
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      modoRegistro,
      validacionRangos,
      alumnos,
      actaCerrada,
      edicionBloqueada: actaCerrada,
    };
  }

  async saveBulk(
    dto: SaveDiagnosticEvaluationsBulkDto,
    req: Request,
    institutionId?: number,
    user?: RequestUser,
  ) {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    if (DIAGNOSTIC_BIMESTRE > bimestreActual) {
      throw new BadRequestException(
        `La evaluación diagnóstica (bimestre ${DIAGNOSTIC_BIMESTRE}) aún no está habilitada. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    await this.assertEditable(dto.nivel, dto.grado, dto.seccion);

    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const config = await this.gradingConfigService.getConfigForInstitution(
      institutionId,
    );
    const modoRegistro = this.resolveModoRegistro(config);
    const rangeBounds = boundsFromConfig(config);

    const students = await this.studentsService.findBySection(
      dto.nivel,
      dto.grado,
      dto.seccion,
      institutionId,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = [...studentMap.keys()];

    const existingEvals = studentIds.length
      ? await this.evalRepo.find({
          where: {
            studentId: In(studentIds),
            curso: dto.curso,
            anio: anioEscolar,
          },
        })
      : [];
    const existingByStudent = new Map(
      existingEvals.map((e) => [e.studentId, e]),
    );

    const actor = parseActorFromRequest(req);
    const auditCtx: DiagnosticAuditContext = {
      actorUserId: actor.usuarioId,
      actorNombre: actor.usuarioNombre,
      actorRol: actor.usuarioRol,
      motivo:
        dto.auditMotivo?.trim() ||
        'Registro de evaluación diagnóstica',
      ip: getClientIp(req),
      correlationId: getCorrelationId(req),
      institutionId: institutionId ?? null,
    };

    let saved = 0;
    const pending: Array<{
      entity: DiagnosticEvaluation;
      before?: DiagnosticEvaluation;
    }> = [];
    const seenStudents = new Set<number>();

    for (const entry of dto.entries) {
      if (seenStudents.has(entry.studentId)) {
        throw new BadRequestException(
          `Entrada duplicada para el estudiante ${entry.studentId} en la misma solicitud.`,
        );
      }
      seenStudents.add(entry.studentId);
      this.validateEntry(entry, modoRegistro, rangeBounds);

      const studentRow = studentMap.get(entry.studentId);
      if (!studentRow || !isStudentMatriculaActiva(studentRow)) {
        throw new BadRequestException(
          `El estudiante ${entry.studentId} no tiene matrícula activa.`,
        );
      }

      const existing =
        (entry.evaluationId
          ? await this.evalRepo.findOneBy({ id: entry.evaluationId })
          : existingByStudent.get(entry.studentId)) ?? null;

      if (existing && existing.curso !== dto.curso) {
        throw new BadRequestException(
          `La evaluación ${entry.evaluationId} no corresponde al curso ${dto.curso}.`,
        );
      }

      if (existing) {
        const before = { ...existing };
        existing.nota =
          entry.nota !== undefined ? entry.nota : existing.nota;
        existing.nivelLogro =
          entry.nivelLogro !== undefined
            ? entry.nivelLogro
            : existing.nivelLogro;
        existing.observacion =
          entry.observacion !== undefined
            ? entry.observacion
            : existing.observacion;
        existing.fechaEvaluacion = dto.fechaEvaluacion;
        existing.registradoPor = user?.id
          ? Number(user.id)
          : existing.registradoPor;
        pending.push({ entity: existing, before });
      } else {
        const entity = this.evalRepo.create({
          studentId: entry.studentId,
          institutionId: institutionId ?? null,
          curso: dto.curso,
          bimestre: DIAGNOSTIC_BIMESTRE,
          anio: anioEscolar,
          nota: entry.nota ?? null,
          nivelLogro: entry.nivelLogro ?? null,
          observacion: entry.observacion ?? undefined,
          fechaEvaluacion: dto.fechaEvaluacion,
          registradoPor: user?.id ? Number(user.id) : undefined,
        });
        pending.push({ entity });
      }
    }

    const persisted = await this.evalRepo.save(
      pending.map((item) => item.entity),
    );

    for (let i = 0; i < persisted.length; i++) {
      const evaluation = persisted[i];
      const item = pending[i];
      if (item.before) {
        await this.changeAudit.recordUpdate(evaluation, item.before, auditCtx);
      } else {
        await this.changeAudit.recordCreate(evaluation, auditCtx);
      }
      saved++;
    }

    const registry = await this.getRegistry({
      nivel: dto.nivel,
      grado: dto.grado,
      seccion: dto.seccion,
      curso: dto.curso,
      institutionId,
    });

    return { saved, registry };
  }

  private validateEntry(
    entry: SaveDiagnosticEvaluationsBulkDto['entries'][number],
    modoRegistro: 'numerico' | 'competencia' | 'mixto',
    rangeBounds: ReturnType<typeof boundsFromConfig>,
  ): void {
    const hasNota = entry.nota !== undefined && entry.nota !== null;
    const hasNivel = !!entry.nivelLogro;

    if (modoRegistro === 'numerico' && !hasNota) {
      throw new BadRequestException(
        `Debe registrar la nota diagnóstica del estudiante ${entry.studentId}.`,
      );
    }
    if (modoRegistro === 'competencia' && !hasNivel) {
      throw new BadRequestException(
        `Debe registrar el nivel de logro diagnóstico del estudiante ${entry.studentId}.`,
      );
    }
    if (modoRegistro === 'mixto' && !hasNota && !hasNivel) {
      throw new BadRequestException(
        `Debe registrar nota o nivel de logro para el estudiante ${entry.studentId}.`,
      );
    }
    if (hasNota) {
      assertNotaInRange(entry.nota!, rangeBounds);
    }
    if (hasNivel && !isNivelLogroDiagnostico(entry.nivelLogro!)) {
      throw new BadRequestException(
        `Nivel de logro inválido para el estudiante ${entry.studentId}.`,
      );
    }
  }

  private resolveModoRegistro(
    config: Awaited<
      ReturnType<GradingConfigService['getConfigForInstitution']>
    >,
  ): 'numerico' | 'competencia' | 'mixto' {
    if (config.usesNumeric && config.usesCompetencias) return 'mixto';
    if (config.usesCompetencias) return 'competencia';
    return 'numerico';
  }

  private async isActaCerrada(
    nivel: string,
    grado: string,
    seccion: string,
  ): Promise<boolean> {
    if (!nivel?.trim() || !grado?.trim() || !seccion?.trim()) {
      return false;
    }
    const anio = String(await this.periodosService.resolveAnioEscolarActual());
    const acta = await this.actaRepo.findOne({
      where: {
        nivel: nivel.trim(),
        grado: grado.trim(),
        seccion: seccion.trim().toUpperCase(),
        bimestre: DIAGNOSTIC_BIMESTRE,
        anio,
      },
    });
    return acta?.estado === 'cerrada';
  }

  private async assertEditable(
    nivel: string,
    grado: string,
    seccion: string,
  ): Promise<void> {
    if (await this.isActaCerrada(nivel, grado, seccion)) {
      throw new BadRequestException(
        'El acta del bimestre diagnóstico está cerrada. Use rectificación autorizada si corresponde.',
      );
    }
  }
}
