import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository, In } from 'typeorm';
import { FormulasEvaluacionMaestrosService } from '../maestros/formulas-evaluacion/formulas-evaluacion.service';
import { CursosMaestrosService } from '../maestros/cursos/cursos.service';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import {
  calcNotaPonderada,
  nivelFromNota,
} from '../maestros/formulas-evaluacion/evaluation-formula.util';
import { GradingConfigService } from '../grading/grading-config.service';
import {
  assertNotaInRange,
  boundsFromConfig,
  buildRangeValidationContext,
  RangeValidationContext,
} from '../grading/grading-range.util';
import { PromediosService } from '../promedios/promedios.service';
import type { PromediosResponse } from '../promedios/promedios.types';
export type {
  AlumnoPromedio,
  CursoPromedio,
  PromediosResumen,
  PromediosResponse,
} from '../promedios/promedios.types';
import { gradosCoinciden } from '../competency-evaluations/competency-evaluations.util';
import { normalizeGradoMatricula } from '../maestros/salones/salones.util';
import { StudentsService } from '../students/students.service';
import {
  dedupeStudentsByPerson,
  isStudentMatriculaActiva,
  listStudentsForAula,
  matchesStudentSection,
} from '../students/students-dedupe.util';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradeAuditContext } from './dto/grade-change-audit.dto';
import { RectifyGradeRegistryDto } from './dto/rectify-grade-registry.dto';
import { SaveGradeRegistryDto } from './dto/grade-registry.dto';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { GradeChangeAuditService } from './grade-change-audit.service';
import { Grade } from './entities/grade.entity';
import { Student } from '../students/entities/student.entity';
import {
  REGISTRO_NOTAS_COMPONENTES,
  REGISTRO_NOTAS_DEMO_COMBOS,
  registroNotasDemoNota,
  registroNotasFechaEvaluacion,
  registroNotasOmitirComponente,
} from './registro-notas-seed.data';

export interface RegistryComponenteNota {
  gradeId?: number;
  nota: number | null;
}

export interface RegistryAlumnoRow {
  studentId: number;
  nombre: string;
  apellido: string;
  codigo: string;
  componentes: Record<string, RegistryComponenteNota>;
  promedioBimestre: number | null;
  nivel: string | null;
}

export interface GradeRegistryResponse {
  formula: Awaited<ReturnType<FormulasEvaluacionMaestrosService['resolve']>>;
  bimestre: number;
  curso: string;
  nivel: string;
  grado: string;
  seccion: string;
  alumnos: RegistryAlumnoRow[];
  bimestreActual: number;
  bimestreHabilitado: boolean;
  validacionRangos: RangeValidationContext;
  actaCerrada: boolean;
  edicionBloqueada: boolean;
}

export interface RectifyRegistryContextResponse {
  bimestreActual: number;
  anioEscolar: number;
  permisos: { rectificar: boolean };
  contexts: RegistryContextItem[];
}

export interface RegistryContextCurso {
  nombre: string;
  conNotas: boolean;
}

export interface RegistryContextItem {
  id: string;
  nivel: string;
  grado: string;
  seccion: string;
  label: string;
  alumnosCount: number;
  cursos: RegistryContextCurso[];
  cursoSugerido: string;
  actaCerrada: boolean;
}

export interface RegistryContextsResponse {
  bimestreActual: number;
  contexts: RegistryContextItem[];
}

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepository: Repository<Grade>,
    @InjectRepository(EvaluationActa)
    private readonly actaRepo: Repository<EvaluationActa>,
    private readonly studentsService: StudentsService,
    private readonly formulasService: FormulasEvaluacionMaestrosService,
    private readonly cursosMaestrosService: CursosMaestrosService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
    private readonly gradingConfigService: GradingConfigService,
    private readonly promediosService: PromediosService,
    private readonly gradeChangeAudit: GradeChangeAuditService,
  ) {}

  async create(
    createGradeDto: CreateGradeDto,
    auditCtx?: GradeAuditContext,
    institutionId?: number,
  ) {
    const student = await this.studentsService.findOne(createGradeDto.studentId);
    if (institutionId !== undefined && student.institutionId !== institutionId) {
      throw new NotFoundException('Alumno no encontrado');
    }
    const config = await this.gradingConfigService.getConfigForInstitution(
      institutionId ?? student.institutionId ?? undefined,
    );
    assertNotaInRange(createGradeDto.nota, boundsFromConfig(config));
    const entity = this.gradesRepository.create({
      ...createGradeDto,
      componenteCodigo:
        createGradeDto.componenteCodigo?.trim() ??
        mapLegacyComponente(createGradeDto.tipo),
      institutionId: student.institutionId,
    });
    const saved = await this.gradesRepository.save(entity);
    const studentMeta = await this.resolveStudentMeta(saved.studentId);
    await this.gradeChangeAudit.recordCreate(saved, studentMeta, auditCtx);
    return saved;
  }

  findAll(query?: {
    studentId?: number;
    curso?: string;
    bimestre?: number;
    institutionId?: number;
  }) {
    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .orderBy('g.fechaEvaluacion', 'DESC');

    if (query?.institutionId !== undefined) {
      qb.andWhere('g.institutionId = :institutionId', {
        institutionId: query.institutionId,
      });
    }

    if (query?.studentId) {
      qb.andWhere('g.studentId = :studentId', { studentId: query.studentId });
    }
    if (query?.curso) {
      qb.andWhere('g.curso = :curso', { curso: query.curso });
    }
    if (query?.bimestre) {
      qb.andWhere('g.bimestre = :bimestre', { bimestre: query.bimestre });
    }

    return qb.getMany();
  }

  findOne(id: number, institutionId?: number) {
    return this.getOrFail(id, institutionId);
  }

  async update(
    id: number,
    updateGradeDto: UpdateGradeDto,
    auditCtx?: GradeAuditContext,
    institutionId?: number,
  ) {
    const current = await this.getOrFail(id, institutionId);
    if (updateGradeDto.nota !== undefined) {
      const config = await this.gradingConfigService.getConfigForInstitution(
        institutionId ?? current.institutionId ?? undefined,
      );
      assertNotaInRange(updateGradeDto.nota, boundsFromConfig(config));
    }
    const before = this.cloneGrade(current);
    const merged = this.gradesRepository.merge(current, updateGradeDto);
    const saved = await this.gradesRepository.save(merged);
    const student = await this.resolveStudentMeta(saved.studentId);
    await this.gradeChangeAudit.recordUpdate(saved, before, student, auditCtx);
    return saved;
  }

  async remove(id: number, auditCtx?: GradeAuditContext, institutionId?: number) {
    const current = await this.getOrFail(id, institutionId);
    const student = await this.resolveStudentMeta(current.studentId);
    await this.gradeChangeAudit.recordDelete(current, student, auditCtx);
    await this.gradesRepository.remove(current);
    return { deleted: true, id };
  }

  findGradeChangeAudit(
    filters?: {
      studentId?: number;
      gradeId?: number;
      curso?: string;
      bimestre?: number;
      accion?: string;
      usuario?: string;
      desde?: string;
      hasta?: string;
      busqueda?: string;
      resultado?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.gradeChangeAudit.findAll(filters);
  }

  async listRegistryContexts(
    bimestre = 2,
    institutionId?: number,
  ): Promise<RegistryContextsResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const students = await this.studentsService.findAll(institutionId);
    const grades = await this.gradesRepository.find(
      institutionId === undefined ? {} : { where: { institutionId } },
    );
    const cursosMaestros = await this.cursosMaestrosService.findAll({
      activo: true,
    });

    const activos = students.filter(
      (s) => isStudentMatriculaActiva(s),
    );

    const groups = new Map<
      string,
      {
        nivel: string;
        grado: string;
        seccion: string;
        studentIds: number[];
      }
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

    const contexts: RegistryContextItem[] = [];

    for (const group of groups.values()) {
      const studentSet = new Set(group.studentIds);
      const gradesSection = grades.filter((g) => studentSet.has(g.studentId));

      const catalog = cursosMaestros
        .filter(
          (c) =>
            c.nivel === group.nivel &&
            (c.grados ?? []).some((g) =>
              gradosCoinciden(group.nivel, g, group.grado),
            ),
        )
        .map((c) => c.nombre);

      const fromGrades = [
        ...new Set(gradesSection.map((g) => g.curso).filter(Boolean)),
      ];

      const nombres = [...new Set([...catalog, ...fromGrades])].sort((a, b) =>
        a.localeCompare(b, 'es'),
      );

      const cursosConNotas = new Set(
        gradesSection
          .filter(
            (g) =>
              g.bimestre === bimestre && g.bimestre <= bimestreActual,
          )
          .map((g) => g.curso),
      );

      const cursos: RegistryContextCurso[] = nombres.map((nombre) => ({
        nombre,
        conNotas: cursosConNotas.has(nombre),
      }));

      const cursoSugerido =
        cursos.find((c) => c.conNotas)?.nombre ??
        cursos.find((c) => c.nombre === 'Matemática')?.nombre ??
        cursos[0]?.nombre ??
        '';

      const actaCerrada = await this.isActaCerrada(
        group.nivel,
        group.grado,
        group.seccion,
        bimestre,
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
      bimestreActual,
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
    bimestre: number;
    institutionId?: number;
  }): Promise<GradeRegistryResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const config = await this.gradingConfigService.getConfigForInstitution(
      query.institutionId,
    );
    const validacionRangos = buildRangeValidationContext(config);
    const students = await this.studentsService.findAll(query.institutionId);
    const filtered = listStudentsForAula(
      students,
      query.nivel,
      query.grado,
      query.seccion,
    );

    const formula = await this.formulasService.resolve({
      nivel: query.nivel,
      grado: query.grado,
      curso: query.curso,
      bimestre: query.bimestre,
    });

    const grades =
      query.bimestre <= bimestreActual
        ? await this.gradesRepository.find({
            where: {
              curso: query.curso,
              bimestre: query.bimestre,
              ...(query.institutionId === undefined
                ? {}
                : { institutionId: query.institutionId }),
            },
          })
        : [];

    const alumnos: RegistryAlumnoRow[] = filtered.map((student) => {
      const studentGrades = grades.filter((g) => g.studentId === student.id);
      const componentes: Record<string, RegistryComponenteNota> = {};
      const notasCalc: Record<string, number | null> = {};

      for (const comp of formula.componentes) {
        const match = studentGrades.find(
          (g) =>
            g.componenteCodigo === comp.codigo ||
            (!g.componenteCodigo && g.tipo === mapTipoFromCodigo(comp.codigo)),
        );
        const nota = match?.nota ?? null;
        componentes[comp.codigo] = {
          gradeId: match?.id,
          nota,
        };
        notasCalc[comp.codigo] = nota;
      }

      const promedioBimestre = calcNotaPonderada(formula.componentes, notasCalc);

      return {
        studentId: student.id,
        nombre: student.nombre,
        apellido: student.apellido,
        codigo: student.codigo || `2026-${String(student.id).padStart(3, '0')}`,
        componentes,
        promedioBimestre,
        nivel:
          promedioBimestre !== null
            ? nivelFromNota(promedioBimestre, formula.escalaLogro)
            : null,
      };
    });

    const actaCerrada = await this.isActaCerrada(
      query.nivel,
      query.grado,
      query.seccion,
      query.bimestre,
    );

    return {
      formula,
      bimestre: query.bimestre,
      curso: query.curso,
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      alumnos,
      bimestreActual,
      bimestreHabilitado: query.bimestre <= bimestreActual,
      validacionRangos,
      actaCerrada,
      edicionBloqueada: actaCerrada,
    };
  }

  async getRectifyContext(
    bimestre = 2,
    user?: RequestUser,
    institutionId?: number,
  ): Promise<RectifyRegistryContextResponse> {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const contexts = (await this.listRegistryContexts(bimestre, institutionId))
      .contexts;

    return {
      bimestreActual,
      anioEscolar,
      permisos: { rectificar: this.canRectify(user) },
      contexts,
    };
  }

  async saveRegistryBulk(
    dto: SaveGradeRegistryDto,
    auditCtx?: GradeAuditContext,
    institutionId?: number,
  ) {
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    if (dto.bimestre > bimestreActual) {
      throw new BadRequestException(
        `El bimestre ${dto.bimestre} aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    await this.assertNotaEditable(dto);

    const config = await this.gradingConfigService.getConfigForInstitution(
      institutionId,
    );
    const rangeBounds = boundsFromConfig(config);

    const students = await this.studentsService.findBySection(
      dto.nivel ?? '',
      dto.grado ?? '',
      dto.seccion ?? '',
      institutionId,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = [...studentMap.keys()];
    const existingGrades = studentIds.length
      ? await this.gradesRepository.find({
          where: {
            studentId: In(studentIds),
            curso: dto.curso,
            bimestre: dto.bimestre,
          },
        })
      : [];
    const gradeKey = (studentId: number, componenteCodigo: string) =>
      `${studentId}:${componenteCodigo}`;
    const existingByKey = new Map(
      existingGrades.map((grade) => [
        gradeKey(grade.studentId, grade.componenteCodigo),
        grade,
      ]),
    );
    const auditBase: GradeAuditContext = {
      ...auditCtx,
      motivo: dto.auditMotivo?.trim() || auditCtx?.motivo || 'Registro masivo de notas',
      nivel: dto.nivel,
      grado: dto.grado,
      seccion: dto.seccion,
    };

    let saved = 0;
    const pending: Array<{
      entity: Grade;
      before?: Grade;
    }> = [];
    for (const entry of dto.entries) {
      assertNotaInRange(entry.nota, rangeBounds);

      const studentRow = studentMap.get(entry.studentId);
      if (!studentRow || !isStudentMatriculaActiva(studentRow)) {
        throw new BadRequestException(
          `El estudiante ${entry.studentId} no tiene matrícula activa.`,
        );
      }

      const lookupKey = gradeKey(entry.studentId, entry.componenteCodigo);
      const existing =
        (entry.gradeId
          ? await this.gradesRepository.findOneBy({ id: entry.gradeId })
          : existingByKey.get(lookupKey)) ?? null;

      if (existing) {
        const before = this.cloneGrade(existing);
        existing.nota = entry.nota;
        existing.fechaEvaluacion = dto.fechaEvaluacion;
        pending.push({ entity: existing, before });
      } else {
        pending.push({
          entity: this.gradesRepository.create({
            studentId: entry.studentId,
            curso: dto.curso,
            bimestre: dto.bimestre,
            nota: entry.nota,
            fechaEvaluacion: dto.fechaEvaluacion,
            componenteCodigo: entry.componenteCodigo,
            tipo: mapTipoFromCodigo(entry.componenteCodigo),
            institutionId: studentMap.get(entry.studentId)?.institutionId ?? null,
          }),
        });
      }
    }

    const persisted = await this.gradesRepository.save(
      pending.map((item) => item.entity),
    );
    for (let i = 0; i < persisted.length; i++) {
      const grade = persisted[i];
      const item = pending[i];
      const studentRow = studentMap.get(grade.studentId);
      if (!studentRow) continue;
      const studentMeta = this.studentMetaFrom(studentRow);
      if (item.before) {
        await this.gradeChangeAudit.recordUpdate(
          grade,
          item.before,
          studentMeta,
          auditBase,
        );
      } else {
        await this.gradeChangeAudit.recordCreate(grade, studentMeta, auditBase);
      }
      saved++;
    }

    const registry = await this.getRegistry({
      nivel: dto.nivel ?? '',
      grado: dto.grado ?? '',
      seccion: dto.seccion ?? '',
      curso: dto.curso,
      bimestre: dto.bimestre,
    });

    await this.promediosService.syncRegistryPromedios(registry);

    return {
      saved,
      registry,
    };
  }

  async saveRegistryRectify(
    dto: RectifyGradeRegistryDto,
    auditCtx?: GradeAuditContext,
    institutionId?: number,
    user?: RequestUser,
  ) {
    if (!this.canRectify(user)) {
      throw new ForbiddenException(
        'No tiene permiso para rectificar calificaciones',
      );
    }

    const motivo = dto.motivo?.trim();
    if (!motivo || motivo.length < 10) {
      throw new BadRequestException(
        'Debe indicar un motivo de rectificación de al menos 10 caracteres',
      );
    }

    const bimestreActual = await this.periodosService.resolveBimestreActual();
    if (dto.bimestre > bimestreActual) {
      throw new BadRequestException(
        `El bimestre ${dto.bimestre} aún no está habilitado. Periodo actual: ${bimestreActual}° bimestre.`,
      );
    }

    const actaCerrada = await this.isActaCerrada(
      dto.nivel ?? '',
      dto.grado ?? '',
      dto.seccion ?? '',
      dto.bimestre,
    );

    const config = await this.gradingConfigService.getConfigForInstitution(
      institutionId,
    );
    const rangeBounds = boundsFromConfig(config);

    const students = await this.studentsService.findBySection(
      dto.nivel ?? '',
      dto.grado ?? '',
      dto.seccion ?? '',
      institutionId,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = [...studentMap.keys()];
    const existingGrades = studentIds.length
      ? await this.gradesRepository.find({
          where: {
            studentId: In(studentIds),
            curso: dto.curso,
            bimestre: dto.bimestre,
          },
        })
      : [];
    const gradeKey = (studentId: number, componenteCodigo: string) =>
      `${studentId}:${componenteCodigo}`;
    const existingByKey = new Map(
      existingGrades.map((grade) => [
        gradeKey(grade.studentId, grade.componenteCodigo),
        grade,
      ]),
    );

    const auditBase: GradeAuditContext = {
      ...auditCtx,
      motivo,
      nivel: dto.nivel,
      grado: dto.grado,
      seccion: dto.seccion,
    };

    let saved = 0;
    const pending: Array<{ entity: Grade; before: Grade }> = [];

    for (const entry of dto.entries) {
      assertNotaInRange(entry.nota, rangeBounds);

      const studentRow = studentMap.get(entry.studentId);
      if (!studentRow || !isStudentMatriculaActiva(studentRow)) {
        throw new BadRequestException(
          `El estudiante ${entry.studentId} no tiene matrícula activa.`,
        );
      }

      const lookupKey = gradeKey(entry.studentId, entry.componenteCodigo);
      const existing =
        (entry.gradeId
          ? await this.gradesRepository.findOneBy({ id: entry.gradeId })
          : existingByKey.get(lookupKey)) ?? null;

      if (!existing) {
        if (actaCerrada) {
          throw new BadRequestException(
            `No existe calificación previa para rectificar (${entry.componenteCodigo}, estudiante ${entry.studentId}). Con acta cerrada solo se permiten correcciones sobre registros existentes.`,
          );
        }
        throw new BadRequestException(
          `La rectificación requiere una calificación existente (${entry.componenteCodigo}, estudiante ${entry.studentId}).`,
        );
      }

      const before = this.cloneGrade(existing);
      if (before.nota === entry.nota) {
        continue;
      }

      existing.nota = entry.nota;
      existing.fechaEvaluacion = dto.fechaEvaluacion;
      pending.push({ entity: existing, before });
    }

    if (!pending.length) {
      throw new BadRequestException(
        'No hay cambios de nota para rectificar. Verifique que los valores difieran de los registrados.',
      );
    }

    const persisted = await this.gradesRepository.save(
      pending.map((item) => item.entity),
    );

    for (let i = 0; i < persisted.length; i++) {
      const grade = persisted[i];
      const item = pending[i];
      const studentRow = studentMap.get(grade.studentId);
      if (!studentRow) continue;
      await this.gradeChangeAudit.recordRectify(
        grade,
        item.before,
        this.studentMetaFrom(studentRow),
        auditBase,
      );
      saved++;
    }

    const registry = await this.getRegistry({
      nivel: dto.nivel ?? '',
      grado: dto.grado ?? '',
      seccion: dto.seccion ?? '',
      curso: dto.curso,
      bimestre: dto.bimestre,
      institutionId,
    });

    await this.promediosService.syncRegistryPromedios(registry);

    return { saved, registry, actaCerrada };
  }

  async computeAverages(query?: {
    nivel?: string;
    grado?: string;
    seccion?: string;
    curso?: string;
    busqueda?: string;
    institutionId?: number;
  }): Promise<PromediosResponse> {
    return this.promediosService.getAverages(query);
  }

  getGradingConfig() {
    return this.gradingConfigService.getConfig();
  }

  private async getOrFail(id: number, institutionId?: number): Promise<Grade> {
    const grade = await this.gradesRepository.findOneBy({ id });
    if (!grade || (institutionId !== undefined && grade.institutionId !== institutionId)) {
      throw new NotFoundException(`Grade ${id} no encontrado`);
    }
    return grade;
  }

  private cloneGrade(grade: Grade): Grade {
    return { ...grade };
  }

  private async resolveStudentMeta(studentId: number) {
    const students = await this.studentsService.findAll();
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return {
        studentCodigo: String(studentId),
        studentNombre: `Estudiante #${studentId}`,
      };
    }
    return this.studentMetaFrom(student);
  }

  private studentMetaFrom(student: Student) {
    return {
      studentCodigo: student.codigo || String(student.id),
      studentNombre: `${student.apellido}, ${student.nombre}`.trim(),
    };
  }

  private async isActaCerrada(
    nivel: string,
    grado: string,
    seccion: string,
    bimestre: number,
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
        bimestre,
        anio,
      },
    });
    return acta?.estado === 'cerrada';
  }

  private async assertNotaEditable(dto: SaveGradeRegistryDto): Promise<void> {
    if (
      await this.isActaCerrada(
        dto.nivel ?? '',
        dto.grado ?? '',
        dto.seccion ?? '',
        dto.bimestre,
      )
    ) {
      throw new BadRequestException(
        'El acta de este salón y bimestre está cerrada. Las notas no pueden modificarse. Use rectificación autorizada si corresponde.',
      );
    }
  }

  private canRectify(user?: RequestUser): boolean {
    return (
      !!user?.permisos?.includes('evaluacion.rectificar') ||
      !!user?.permisos?.includes('evaluacion.aprobar')
    );
  }

  /** Notas por componente (componenteCodigo) para el registro de evaluación. */
  async seedRegistroNotasDemo(): Promise<void> {
    await this.backfillComponenteCodigoLegacy();

    const minConComponente = 60;
    const existentes = await this.gradesRepository.count({
      where: { componenteCodigo: Not('') },
    });
    if (existentes >= minConComponente) return;

    const students = await this.studentsService.findAll();
    const activos = students.filter(
      (s) => isStudentMatriculaActiva(s),
    );

    for (const combo of REGISTRO_NOTAS_DEMO_COMBOS) {
      const alumnos = activos
        .filter(
          (s) =>
            s.nivel === combo.nivel &&
            s.grado === combo.grado &&
            s.seccion.toUpperCase() === combo.seccion.toUpperCase(),
        )
        .sort((a, b) =>
          `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
        );

      if (!alumnos.length) continue;

      for (const alumno of alumnos) {
        for (const [compIdx, comp] of REGISTRO_NOTAS_COMPONENTES.entries()) {
          if (registroNotasOmitirComponente(alumno.id, compIdx)) continue;

          const duplicado = await this.gradesRepository.findOne({
            where: {
              studentId: alumno.id,
              curso: combo.curso,
              bimestre: combo.bimestre,
              componenteCodigo: comp.codigo,
            },
          });
          if (duplicado) continue;

          await this.gradesRepository.save(
            this.gradesRepository.create({
              studentId: alumno.id,
              curso: combo.curso,
              bimestre: combo.bimestre,
              componenteCodigo: comp.codigo,
              tipo: comp.tipo,
              nota: registroNotasDemoNota(
                alumno.id,
                combo.bimestre,
                compIdx,
                combo.curso,
              ),
              fechaEvaluacion: registroNotasFechaEvaluacion(
                combo.bimestre,
                comp.dia,
              ),
              descripcion: `${combo.grado} ${combo.seccion} — ${comp.codigo} B${combo.bimestre}`,
            }),
          );
        }
      }
    }
  }

  /** Asigna componenteCodigo a notas antiguas (tipo daily/partial/final). */
  private async backfillComponenteCodigoLegacy(): Promise<void> {
    const legacy = await this.gradesRepository
      .createQueryBuilder('g')
      .where(`COALESCE(g."componenteCodigo", '') = ''`)
      .getMany();

    for (const row of legacy) {
      row.componenteCodigo = mapLegacyComponente(row.tipo);
      await this.gradesRepository.save(row);
    }
  }
}

function mapTipoFromCodigo(codigo: string): Grade['tipo'] {
  const lower = codigo.toLowerCase();
  if (lower.includes('final')) return 'final';
  if (lower.includes('parcial') || lower.includes('examen')) return 'partial';
  return 'daily';
}

function mapLegacyComponente(tipo: Grade['tipo']): string {
  if (tipo === 'final') return 'examen_final';
  if (tipo === 'partial') return 'examen_parcial';
  return 'trabajo_exposicion';
}
