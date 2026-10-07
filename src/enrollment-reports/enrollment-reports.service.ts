import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Request } from 'express';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { Student } from '../students/entities/student.entity';
import type { NormalizedEnrollmentReportQuery } from './dto/enrollment-report-query.dto';
import {
  ENROLLMENT_REPORT_SOURCES,
  type EnrollmentReportType,
} from './enrollment-reports.constants';
import {
  resolveReportScope,
  type ReportScope,
} from '../evaluation-reports/evaluation-reports-scope.util';
import {
  paginateRows,
  type EvaluationReportResponse,
  type ReportColumn,
  type ReportMeta,
  type ReportRow,
  matchesBusqueda as matchSearch,
} from '../evaluation-reports/evaluation-reports.util';

export interface EnrollmentReportContext {
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
  periodoActual: number;
  anioEscolar: number;
  tiposDisponibles: EnrollmentReportType[];
  permisoConsulta: string;
  permisoExportacion: string;
  filtros: {
    niveles: string[];
    grados: string[];
    secciones: string[];
    periodos: number[];
    estadosMatricula: string[];
    dres: string[];
    ugels: string[];
  };
  fuentes: Record<EnrollmentReportType, string>;
}

@Injectable()
export class EnrollmentReportsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
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

  async getContext(scope: ReportScope): Promise<EnrollmentReportContext> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const periodoActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();

    const niveles = new Set<string>();
    const grados = new Set<string>();
    const secciones = new Set<string>();

    for (const inst of await this.loadInstitutions(scope.institutionIds)) {
      for (const n of inst.niveles ?? []) {
        if (n.nombre) niveles.add(n.nombre);
        for (const g of n.grados ?? []) {
          if (g.nombre) grados.add(g.nombre);
          for (const s of g.secciones ?? []) {
            if (s) secciones.add(String(s).toUpperCase());
          }
        }
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
      periodoActual,
      anioEscolar,
      tiposDisponibles: ['matricula_global', 'matricula_resumen'],
      permisoConsulta: 'matricula.reportes',
      permisoExportacion: 'matricula.exportar',
      filtros: {
        niveles: [...niveles].sort(),
        grados: [...grados].sort(),
        secciones: [...secciones].sort(),
        periodos: [1, 2, 3, 4],
        estadosMatricula: ['activo', 'inactivo', 'retirado'],
        dres,
        ugels,
      },
      fuentes: { ...ENROLLMENT_REPORT_SOURCES },
    };
  }

  async buildReport(
    query: NormalizedEnrollmentReportQuery,
    scope: ReportScope,
  ): Promise<EvaluationReportResponse> {
    const { meta, columns, rows } =
      query.tipo === 'matricula_resumen'
        ? await this.buildResumenReport(query, scope)
        : await this.buildGlobalReport(query, scope);

    const paginated = paginateRows(rows, query.page, query.pageSize);
    return {
      meta,
      columns,
      items: paginated.items,
      pagination: paginated.pagination,
    };
  }

  private async buildGlobalReport(
    query: NormalizedEnrollmentReportQuery,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, scope, 'matricula_global');
    const consolidado = scope.mode === 'consolidado';
    const columns: ReportColumn[] = [
      ...(consolidado ? [{ key: 'institucion', label: 'Institución' }] : []),
      { key: 'codigo', label: 'Código' },
      { key: 'dni', label: 'Documento' },
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'grado', label: 'Grado' },
      { key: 'seccion', label: 'Sección' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'estadoMatricula', label: 'Estado matrícula' },
      { key: 'activo', label: 'Activo' },
      { key: 'anioIngreso', label: 'Año ingreso' },
    ];

    const students = await this.fetchStudents(query, scope);
    const instMap = await this.institutionNameMap(scope.institutionIds);

    const seenIds = new Set<number>();
    const rows: ReportRow[] = [];
    for (const st of students) {
      if (seenIds.has(st.id)) continue;
      seenIds.add(st.id);

      const nombre = `${st.apellido} ${st.nombre}`.trim();
      if (
        !matchSearch(
          query.busqueda,
          nombre,
          st.codigo,
          st.dni,
          st.codigoNacional,
        )
      ) {
        continue;
      }

      rows.push({
        ...(consolidado
          ? { institucion: instMap.get(st.institutionId ?? 0) ?? '—' }
          : {}),
        codigo: st.codigo || st.codigoNacional || '—',
        dni: st.dni || '—',
        estudiante: nombre,
        nivel: st.nivel,
        grado: st.grado,
        seccion: st.seccion,
        sexo: st.sexo === 'F' ? 'Femenino' : 'Masculino',
        estadoMatricula: st.estadoMatricula,
        activo: st.activo ? 'Sí' : 'No',
        anioIngreso: st.anioIngreso,
      });
    }

    rows.sort((a, b) =>
      String(a.estudiante).localeCompare(String(b.estudiante), 'es'),
    );

    meta.totales = this.computeStudentTotales(rows, scope);
    return { meta, columns, rows };
  }

  private async buildResumenReport(
    query: NormalizedEnrollmentReportQuery,
    scope: ReportScope,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, scope, 'matricula_resumen');
    const consolidado = scope.mode === 'consolidado';
    const columns: ReportColumn[] = [
      ...(consolidado ? [{ key: 'institucion', label: 'Institución' }] : []),
      { key: 'nivel', label: 'Nivel' },
      { key: 'grado', label: 'Grado' },
      { key: 'seccion', label: 'Sección' },
      { key: 'total', label: 'Total alumnos' },
      { key: 'activos', label: 'Activos' },
      { key: 'inactivos', label: 'Inactivos' },
      { key: 'retirados', label: 'Retirados' },
      { key: 'mujeres', label: 'Mujeres' },
      { key: 'varones', label: 'Varones' },
    ];

    const students = await this.fetchStudents(query, scope);
    const instMap = await this.institutionNameMap(scope.institutionIds);
    const buckets = new Map<string, Student[]>();

    const seenIds = new Set<number>();
    for (const st of students) {
      if (seenIds.has(st.id)) continue;
      seenIds.add(st.id);
      const instKey = consolidado ? String(st.institutionId ?? 0) : 'ie';
      const key = `${instKey}|${st.nivel}|${st.grado}|${st.seccion?.toUpperCase()}`;
      const list = buckets.get(key) ?? [];
      list.push(st);
      buckets.set(key, list);
    }

    const rows: ReportRow[] = [];
    for (const [, group] of buckets) {
      const sample = group[0];
      const activos = group.filter((s) => s.estadoMatricula === 'activo').length;
      const inactivos = group.filter((s) => s.estadoMatricula === 'inactivo').length;
      const retirados = group.filter((s) => s.estadoMatricula === 'retirado').length;
      rows.push({
        ...(consolidado
          ? {
              institucion:
                instMap.get(sample.institutionId ?? 0) ?? '—',
            }
          : {}),
        nivel: sample.nivel,
        grado: sample.grado,
        seccion: sample.seccion,
        total: group.length,
        activos,
        inactivos,
        retirados,
        mujeres: group.filter((s) => s.sexo === 'F').length,
        varones: group.filter((s) => s.sexo === 'M').length,
      });
    }

    rows.sort((a, b) => {
      const ka = `${a.institucion ?? ''}|${a.nivel}|${a.grado}|${a.seccion}`;
      const kb = `${b.institucion ?? ''}|${b.nivel}|${b.grado}|${b.seccion}`;
      return ka.localeCompare(kb, 'es');
    });

    meta.totales = {
      totalRegistros: rows.length,
      totalAlumnos: students.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i).length,
      aulasReportadas: rows.length,
      institucionesIncluidas: scope.alcance.institucionesCount,
    };

    return { meta, columns, rows };
  }

  private async fetchStudents(
    query: NormalizedEnrollmentReportQuery,
    scope: ReportScope,
  ): Promise<Student[]> {
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.institutionId IN (:...ids)', { ids: scope.institutionIds });

    if (query.nivel) {
      qb.andWhere('LOWER(TRIM(s.nivel)) = LOWER(TRIM(:nivel))', {
        nivel: query.nivel,
      });
    }
    if (query.grado) {
      qb.andWhere('LOWER(TRIM(s.grado)) = LOWER(TRIM(:grado))', {
        grado: query.grado,
      });
    }
    if (query.seccion) {
      qb.andWhere('UPPER(TRIM(s.seccion)) = UPPER(TRIM(:seccion))', {
        seccion: query.seccion,
      });
    }
    if (query.estadoMatricula) {
      qb.andWhere('s.estadoMatricula = :estado', {
        estado: query.estadoMatricula,
      });
    }
    if (query.anio) {
      qb.andWhere('s.anioIngreso = :anioIngreso', {
        anioIngreso: String(query.anio),
      });
    }

    return qb
      .orderBy('s.apellido', 'ASC')
      .addOrderBy('s.nombre', 'ASC')
      .getMany();
  }

  private computeStudentTotales(
    rows: ReportRow[],
    scope: ReportScope,
  ): Record<string, number | null> {
    return {
      totalAlumnos: rows.length,
      activos: rows.filter((r) => r.estadoMatricula === 'activo').length,
      inactivos: rows.filter((r) => r.estadoMatricula === 'inactivo').length,
      retirados: rows.filter((r) => r.estadoMatricula === 'retirado').length,
      mujeres: rows.filter((r) => r.sexo === 'Femenino').length,
      varones: rows.filter((r) => r.sexo === 'Masculino').length,
      institucionesIncluidas: scope.alcance.institucionesCount,
    };
  }

  private async buildMeta(
    query: NormalizedEnrollmentReportQuery,
    scope: ReportScope,
    tipo: EnrollmentReportType,
  ): Promise<ReportMeta> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const anioEscolar =
      query.anio ??
      (await this.periodosService.resolveAnioEscolarActual());
    const periodo =
      query.periodo ?? (await this.periodosService.resolveBimestreActual());

    return {
      fechaCorte: new Date().toISOString(),
      anioEscolar,
      bimestre: periodo,
      tipo,
      fuente: ENROLLMENT_REPORT_SOURCES[tipo],
      parametros: { ...query, scopeKey: scope.scopeKey },
      institucion: {
        id: institution.id,
        nombre: institution.nombre,
        siglas: institution.siglas,
        dre: institution.dre,
        ugel: institution.ugel,
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
      totales: {},
    };
  }

  private async resolveInstitution(id: number): Promise<Institution> {
    const inst = await this.institutionRepo.findOne({ where: { id } });
    if (!inst) {
      throw new NotFoundException('Institución educativa no encontrada');
    }
    return inst;
  }

  private async loadInstitutions(ids: number[]): Promise<Institution[]> {
    if (!ids.length) return [];
    return this.institutionRepo.find({ where: { id: In(ids) } });
  }

  private async institutionNameMap(
    ids: number[],
  ): Promise<Map<number, string>> {
    const insts = await this.loadInstitutions(ids);
    return new Map(insts.map((i) => [i.id, i.nombre]));
  }
}
