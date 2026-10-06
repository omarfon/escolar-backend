import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Institution } from '../institution/entities/institution.entity';
import { Grade } from '../grades/entities/grade.entity';
import { GradesService } from '../grades/grades.service';
import { CompetencyEvaluation } from '../competency-evaluations/entities/competency-evaluation.entity';
import { DiagnosticEvaluation } from '../diagnostic-evaluations/entities/diagnostic-evaluation.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { PromediosService } from '../promedios/promedios.service';
import { StudentsService } from '../students/students.service';
import { listStudentsForAula } from '../students/students-dedupe.util';
import type { NormalizedReportQuery } from './dto/evaluation-report-query.dto';
import {
  REPORT_SOURCES,
  type EvaluationReportType,
} from './evaluation-reports.constants';
import type { Request } from 'express';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  resolveReportScope,
  type ReportScope,
} from './evaluation-reports-scope.util';
import {
  mergeTotales,
  paginateRows,
  type EvaluationReportResponse,
  type ReportColumn,
  type ReportMeta,
  type ReportRow,
  matchesBusqueda as matchSearch,
} from './evaluation-reports.util';

export interface EvaluationReportContext {
  institucion: {
    id: number;
    nombre: string;
    siglas: string;
    dre: string;
    ugel: string;
    anioEscolar: number;
  };
  alcance: {
    nivel: string;
    dre: string | null;
    ugel: string | null;
    label: string;
    consolidado: boolean;
    institucionesCount: number;
  };
  bimestreActual: number;
  anioEscolar: number;
  tiposDisponibles: EvaluationReportType[];
  permisoConsulta: string;
  permisoExportacion: string;
  filtros: {
    niveles: string[];
    grados: string[];
    secciones: string[];
    cursos: string[];
    bimestres: number[];
    dres: string[];
    ugels: string[];
  };
  fuentes: Record<EvaluationReportType, string>;
}

@Injectable()
export class EvaluationReportsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(CompetencyEvaluation)
    private readonly competencyRepo: Repository<CompetencyEvaluation>,
    @InjectRepository(DiagnosticEvaluation)
    private readonly diagnosticRepo: Repository<DiagnosticEvaluation>,
    @InjectRepository(CurriculumSubject)
    private readonly subjectRepo: Repository<CurriculumSubject>,
    private readonly gradesService: GradesService,
    private readonly promediosService: PromediosService,
    private readonly studentsService: StudentsService,
    private readonly periodosService: PeriodosAcademicosMaestrosService,
  ) {}

  async resolveScope(
    req: Request & { user?: RequestUser },
    dre?: string,
    ugel?: string,
  ): Promise<ReportScope> {
    if (!req.user) {
      throw new NotFoundException('Usuario no autenticado');
    }
    return resolveReportScope(req.user, req, this.institutionRepo, dre, ugel);
  }

  async getContext(scope: ReportScope): Promise<EvaluationReportContext> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const bimestreActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();

    const niveles = new Set<string>();
    const grados = new Set<string>();
    const secciones = new Set<string>();
    const cursos = new Set<string>();

    for (const instId of scope.institutionIds) {
      const contexts = await this.gradesService.listRegistryContexts(
        bimestreActual,
        instId,
      );
      for (const ctx of contexts.contexts) {
        niveles.add(ctx.nivel);
        grados.add(ctx.grado);
        secciones.add(ctx.seccion);
        for (const c of ctx.cursos) cursos.add(c.nombre);
        if (ctx.cursoSugerido) cursos.add(ctx.cursoSugerido);
      }
    }

    const allInst = await this.institutionRepo.find({ order: { nombre: 'ASC' } });
    const dres = [...new Set(allInst.map((i) => i.dre).filter(Boolean))].sort();
    const ugels = [...new Set(allInst.map((i) => i.ugel).filter(Boolean))].sort();

    return {
      institucion: {
        id: institution.id,
        nombre: scope.mode === 'consolidado' ? scope.alcance.label : institution.nombre,
        siglas: institution.siglas,
        dre: scope.alcance.dre ?? institution.dre,
        ugel: scope.alcance.ugel ?? institution.ugel,
        anioEscolar: Number(institution.anio) || anioEscolar,
      },
      alcance: {
        nivel: scope.alcance.nivel,
        dre: scope.alcance.dre,
        ugel: scope.alcance.ugel,
        label: scope.alcance.label,
        consolidado: scope.mode === 'consolidado',
        institucionesCount: scope.alcance.institucionesCount,
      },
      bimestreActual,
      anioEscolar,
      tiposDisponibles: ['promedios', 'notas', 'competencias', 'diagnostico'],
      permisoConsulta: 'evaluacion.reportes',
      permisoExportacion: 'evaluacion.exportar',
      filtros: {
        niveles: [...niveles].sort(),
        grados: [...grados].sort(),
        secciones: [...secciones].sort(),
        cursos: [...cursos].sort(),
        bimestres: [1, 2, 3, 4].filter((b) => b <= bimestreActual),
        dres,
        ugels,
      },
      fuentes: { ...REPORT_SOURCES },
    };
  }

  async buildReport(
    query: NormalizedReportQuery,
    scope: ReportScope,
  ): Promise<EvaluationReportResponse> {
    this.assertRequiredFilters(query);
    this.assertTerritorialFilters(scope, query);

    const instNames = new Map<number, string>();
    if (scope.mode === 'consolidado') {
      const insts = await this.institutionRepo.find({
        where: { id: In(scope.institutionIds) },
      });
      for (const i of insts) {
        instNames.set(i.id, i.siglas || i.nombre);
      }
    }

    let mergedMeta: ReportMeta | null = null;
    let mergedColumns: ReportColumn[] | null = null;
    let allRows: ReportRow[] = [];

    for (const instId of scope.institutionIds) {
      const partial = await this.buildReportForInstitution(query, instId, scope);
      if (!mergedMeta) {
        mergedMeta = partial.meta;
        mergedColumns = [...partial.columns];
      } else {
        mergedMeta.totales = mergeTotales(mergedMeta.totales, partial.meta.totales);
      }

      const rows = partial.rows.map((row) => {
        if (scope.mode !== 'consolidado') return row;
        return {
          institucion: instNames.get(instId) ?? String(instId),
          ...row,
        };
      });
      allRows.push(...rows);
    }

    if (!mergedMeta || !mergedColumns) {
      throw new BadRequestException('No se pudo generar el reporte');
    }

    if (scope.mode === 'consolidado' && !mergedColumns.some((c) => c.key === 'institucion')) {
      mergedColumns.unshift({ key: 'institucion', label: 'Institución' });
    }

    mergedMeta.alcance = {
      nivel: scope.alcance.nivel,
      dre: scope.alcance.dre,
      ugel: scope.alcance.ugel,
      label: scope.alcance.label,
      consolidado: scope.mode === 'consolidado',
      institucionesCount: scope.alcance.institucionesCount,
    };

    if (scope.mode === 'consolidado') {
      mergedMeta.institucion = {
        id: scope.primaryInstitutionId,
        nombre: scope.alcance.label,
        siglas: '',
        dre: scope.alcance.dre ?? '',
        ugel: scope.alcance.ugel ?? '',
        anioEscolar: mergedMeta.anioEscolar,
      };
      mergedMeta.totales = {
        ...mergedMeta.totales,
        institucionesIncluidas: scope.institutionIds.length,
      };
    }

    const { items, pagination } = paginateRows(allRows, query.page, query.pageSize);
    return {
      meta: mergedMeta,
      columns: mergedColumns,
      items,
      pagination,
    };
  }

  private async buildReportForInstitution(
    query: NormalizedReportQuery,
    institutionId: number,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    switch (query.tipo) {
      case 'promedios':
        return this.buildPromediosReport(query, institutionId, scope);
      case 'notas':
        return this.buildNotasReport(query, institutionId, scope);
      case 'competencias':
        return this.buildCompetenciasReport(query, institutionId, scope);
      case 'diagnostico':
        return this.buildDiagnosticoReport(query, institutionId, scope);
      default:
        throw new BadRequestException('Tipo de reporte no soportado');
    }
  }

  private async buildPromediosReport(
    query: NormalizedReportQuery,
    institutionId: number,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, institutionId, 'promedios', scope);
    const columns: ReportColumn[] = [
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'grado', label: 'Grado' },
      { key: 'seccion', label: 'Sección' },
      { key: 'promedioGeneral', label: 'Promedio general' },
      { key: 'nivelGeneral', label: 'Nivel general' },
      { key: 'cursosRegistrados', label: 'Cursos con datos' },
    ];

    const data = await this.promediosService.getAverages({
      nivel: query.nivel,
      grado: query.grado,
      seccion: query.seccion,
      curso: query.curso,
      busqueda: query.busqueda,
      institutionId,
    });

    let rows: ReportRow[] = data.alumnos.map((a) => ({
      estudiante: a.estudiante,
      nivel: a.nivel,
      grado: a.grado,
      seccion: a.seccion,
      promedioGeneral: a.promedioGeneral,
      nivelGeneral: a.nivelGeneral,
      cursosRegistrados: a.cursos.length,
    }));

    rows = rows.filter((r) =>
      matchSearch(query.busqueda, r.estudiante, r.nivel, r.grado, r.seccion),
    );

    meta.totales = {
      totalAlumnos: rows.length,
      promedioAula: data.resumen.promedioAula,
      aprobados: data.resumen.aprobados,
      desaprobados: data.resumen.desaprobados,
      enRiesgo: data.resumen.enRiesgo,
      destacados: data.resumen.destacados,
    };

    return { meta, columns, rows };
  }

  private async buildNotasReport(
    query: NormalizedReportQuery,
    institutionId: number,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, institutionId, 'notas', scope);
    const columns: ReportColumn[] = [
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'curso', label: 'Curso' },
      { key: 'componente', label: 'Componente' },
      { key: 'bimestre', label: 'Bimestre' },
      { key: 'nota', label: 'Nota' },
      { key: 'fecha', label: 'Fecha evaluación' },
    ];

    const students = listStudentsForAula(
      await this.studentsService.findAll(institutionId),
      query.nivel!,
      query.grado!,
      query.seccion!,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = students.map((s) => s.id);
    if (!studentIds.length) {
      return { meta, columns, rows: [] };
    }

    const where: Record<string, unknown> = {
      studentId: In(studentIds),
      institutionId,
    };
    if (query.bimestre) where.bimestre = query.bimestre;
    if (query.curso) where.curso = query.curso;

    const grades = await this.gradeRepo.find({ where, order: { curso: 'ASC' } });

    const rows: ReportRow[] = [];
    for (const g of grades) {
      const st = studentMap.get(g.studentId);
      if (!st) continue;
      const row: ReportRow = {
        estudiante: `${st.apellido} ${st.nombre}`.trim(),
        curso: g.curso,
        componente: g.componenteCodigo || g.tipo,
        bimestre: g.bimestre,
        nota: g.nota,
        fecha: g.fechaEvaluacion,
      };
      if (matchSearch(query.busqueda, row.estudiante, row.curso, row.componente)) {
        rows.push(row);
      }
    }

    meta.totales = {
      totalRegistros: rows.length,
      promedioNotas:
        rows.length > 0
          ? Math.round(
              (rows.reduce((s, r) => s + Number(r.nota ?? 0), 0) / rows.length) * 10,
            ) / 10
          : null,
      alumnosUnicos: new Set(grades.map((g) => g.studentId)).size,
    };

    return { meta, columns, rows };
  }

  private async buildCompetenciasReport(
    query: NormalizedReportQuery,
    institutionId: number,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, institutionId, 'competencias', scope);
    const columns: ReportColumn[] = [
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'competencia', label: 'Competencia' },
      { key: 'bimestre', label: 'Bimestre' },
      { key: 'nivelLogro', label: 'Nivel de logro' },
      { key: 'observacion', label: 'Observación' },
    ];

    const anio = query.anio ?? meta.anioEscolar;
    const students = listStudentsForAula(
      await this.studentsService.findAll(institutionId),
      query.nivel!,
      query.grado!,
      query.seccion!,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = students.map((s) => s.id);
    if (!studentIds.length) {
      return { meta, columns, rows: [] };
    }

    const where: Record<string, unknown> = {
      studentId: In(studentIds),
      institutionId,
      anio,
    };
    if (query.bimestre) where.bimestre = query.bimestre;

    const evals = await this.competencyRepo.find({ where, order: { bimestre: 'ASC' } });
    const compIds = [...new Set(evals.map((e) => e.competenciaId))];
    const subjects =
      compIds.length > 0
        ? await this.subjectRepo.find({ where: { id: In(compIds) } })
        : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s.nombre]));

    const rows: ReportRow[] = [];
    for (const ev of evals) {
      const st = studentMap.get(ev.studentId);
      if (!st) continue;
      const compNombre = subjectMap.get(ev.competenciaId) ?? `Comp. ${ev.competenciaId}`;
      if (query.curso && !compNombre.toLowerCase().includes(query.curso.toLowerCase())) {
        continue;
      }
      const row: ReportRow = {
        estudiante: `${st.apellido} ${st.nombre}`.trim(),
        competencia: compNombre,
        bimestre: ev.bimestre,
        nivelLogro: ev.nivelLogro,
        observacion: ev.observacion ?? '',
      };
      if (matchSearch(query.busqueda, row.estudiante, row.competencia, row.nivelLogro)) {
        rows.push(row);
      }
    }

    meta.totales = {
      totalRegistros: rows.length,
      alumnosUnicos: new Set(evals.map((e) => e.studentId)).size,
      competenciasUnicas: compIds.length,
    };

    return { meta, columns, rows };
  }

  private async buildDiagnosticoReport(
    query: NormalizedReportQuery,
    institutionId: number,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, institutionId, 'diagnostico', scope);
    const columns: ReportColumn[] = [
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'curso', label: 'Curso' },
      { key: 'nota', label: 'Nota' },
      { key: 'nivelLogro', label: 'Nivel de logro' },
      { key: 'fecha', label: 'Fecha evaluación' },
    ];

    const anio = query.anio ?? meta.anioEscolar;
    const students = listStudentsForAula(
      await this.studentsService.findAll(institutionId),
      query.nivel!,
      query.grado!,
      query.seccion!,
    );
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = students.map((s) => s.id);
    if (!studentIds.length) {
      return { meta, columns, rows: [] };
    }

    const where: Record<string, unknown> = {
      studentId: In(studentIds),
      institutionId,
      anio,
    };
    if (query.curso) where.curso = query.curso;

    const evals = await this.diagnosticRepo.find({ where, order: { curso: 'ASC' } });

    const rows: ReportRow[] = [];
    for (const ev of evals) {
      const st = studentMap.get(ev.studentId);
      if (!st) continue;
      const row: ReportRow = {
        estudiante: `${st.apellido} ${st.nombre}`.trim(),
        curso: ev.curso,
        nota: ev.nota,
        nivelLogro: ev.nivelLogro,
        fecha: ev.fechaEvaluacion,
      };
      if (matchSearch(query.busqueda, row.estudiante, row.curso, row.nivelLogro)) {
        rows.push(row);
      }
    }

    meta.totales = {
      totalRegistros: rows.length,
      alumnosUnicos: new Set(evals.map((e) => e.studentId)).size,
      cursosUnicos: new Set(evals.map((e) => e.curso)).size,
    };

    return { meta, columns, rows };
  }

  private async buildMeta(
    query: NormalizedReportQuery,
    institutionId: number,
    tipo: EvaluationReportType,
    scope: ReportScope,
  ): Promise<ReportMeta> {
    const institution = await this.resolveInstitution(institutionId);
    const anioEscolar =
      query.anio ?? (await this.periodosService.resolveAnioEscolarActual());
    return {
      fechaCorte: new Date().toISOString(),
      anioEscolar,
      bimestre: query.bimestre ?? null,
      tipo,
      fuente: REPORT_SOURCES[tipo],
      parametros: {
        nivel: query.nivel,
        grado: query.grado,
        seccion: query.seccion,
        curso: query.curso,
        bimestre: query.bimestre,
        anio: query.anio,
        dre: query.dre,
        ugel: query.ugel,
        busqueda: query.busqueda,
      },
      institucion: {
        id: institution.id,
        nombre: institution.nombre,
        siglas: institution.siglas,
        dre: institution.dre,
        ugel: institution.ugel,
        anioEscolar: Number(institution.anio) || anioEscolar,
      },
      totales: {},
    };
  }

  private assertRequiredFilters(query: NormalizedReportQuery): void {
    if (!query.nivel || !query.grado || !query.seccion) {
      throw new BadRequestException(
        'Los filtros nivel, grado y sección son obligatorios para este reporte',
      );
    }
  }

  private assertTerritorialFilters(
    scope: ReportScope,
    query: NormalizedReportQuery,
  ): void {
    if (scope.mode === 'institucion') return;

    if (scope.alcance.nivel === 'DRE' && query.dre) {
      const expected = scope.alcance.dre?.trim().toLowerCase();
      if (expected && query.dre.trim().toLowerCase() !== expected) {
        throw new BadRequestException('El filtro DRE no coincide con su ámbito territorial');
      }
    }
    if (scope.alcance.nivel === 'UGEL' && query.ugel) {
      const expected = scope.alcance.ugel?.trim().toLowerCase();
      if (expected && query.ugel.trim().toLowerCase() !== expected) {
        throw new BadRequestException('El filtro UGEL no coincide con su ámbito territorial');
      }
    }
  }

  private async resolveInstitution(institutionId?: number): Promise<Institution> {
    if (institutionId != null && institutionId > 0) {
      const inst = await this.institutionRepo.findOne({ where: { id: institutionId } });
      if (!inst) {
        throw new NotFoundException('Institución educativa no encontrada');
      }
      return inst;
    }
    const inst = await this.institutionRepo.findOne({ where: {}, order: { id: 'ASC' } });
    if (!inst) {
      throw new NotFoundException('No hay institución configurada');
    }
    return inst;
  }
}
