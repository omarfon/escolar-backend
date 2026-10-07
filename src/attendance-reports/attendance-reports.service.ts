import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Request } from 'express';
import { Attendance } from '../attendances/entities/attendance.entity';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Institution } from '../institution/entities/institution.entity';
import { PeriodosAcademicosMaestrosService } from '../maestros/periodos-academicos/periodos-academicos.service';
import { Student } from '../students/entities/student.entity';
import type { NormalizedAttendanceReportQuery } from './dto/attendance-report-query.dto';
import {
  ATTENDANCE_REPORT_SOURCES,
  ESTADO_ASISTENCIA_LABEL,
  type AttendanceReportType,
} from './attendance-reports.constants';
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

export interface AttendanceReportContext {
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
  mesActual: string;
  tiposDisponibles: AttendanceReportType[];
  permisoConsulta: string;
  permisoExportacion: string;
  filtros: {
    niveles: string[];
    grados: string[];
    secciones: string[];
    periodos: number[];
    estados: string[];
    dres: string[];
    ugels: string[];
  };
  fuentes: Record<AttendanceReportType, string>;
}

@Injectable()
export class AttendanceReportsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
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

  async getContext(scope: ReportScope): Promise<AttendanceReportContext> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const periodoActual = await this.periodosService.resolveBimestreActual();
    const anioEscolar = await this.periodosService.resolveAnioEscolarActual();
    const mesActual = this.currentMes();

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
      mesActual,
      tiposDisponibles: ['asistencia_detalle', 'asistencia_resumen'],
      permisoConsulta: 'asistencia.reportes',
      permisoExportacion: 'asistencia.exportar',
      filtros: {
        niveles: [...niveles].sort(),
        grados: [...grados].sort(),
        secciones: [...secciones].sort(),
        periodos: [1, 2, 3, 4],
        estados: ['P', 'F', 'T', 'J'],
        dres,
        ugels,
      },
      fuentes: { ...ATTENDANCE_REPORT_SOURCES },
    };
  }

  async buildReport(
    query: NormalizedAttendanceReportQuery,
    scope: ReportScope,
  ): Promise<EvaluationReportResponse> {
    const mes = this.resolveMes(query);
    const queryWithMes = { ...query, mes };

    const { meta, columns, rows } =
      query.tipo === 'asistencia_resumen'
        ? await this.buildResumenReport(queryWithMes, scope, mes)
        : await this.buildDetalleReport(queryWithMes, scope, mes);

    const paginated = paginateRows(rows, query.page, query.pageSize);
    return {
      meta,
      columns,
      items: paginated.items,
      pagination: paginated.pagination,
    };
  }

  private async buildDetalleReport(
    query: NormalizedAttendanceReportQuery,
    scope: ReportScope,
    mes: string,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, scope, 'asistencia_detalle', mes);
    const consolidado = scope.mode === 'consolidado';
    const columns: ReportColumn[] = [
      ...(consolidado ? [{ key: 'institucion', label: 'Institución' }] : []),
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'grado', label: 'Grado' },
      { key: 'seccion', label: 'Sección' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'estado', label: 'Estado' },
      { key: 'observacion', label: 'Observación' },
    ];

    const students = await this.fetchStudents(query, scope.institutionIds);
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentIds = students.map((s) => s.id);
    const instMap = await this.institutionNameMap(scope.institutionIds);

    if (!studentIds.length) {
      meta.totales = { totalRegistros: 0, totalAlumnos: 0 };
      return { meta, columns, rows: [] };
    }

    const { desde, hasta } = this.mesRange(mes);
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.studentId IN (:...studentIds)', { studentIds })
      .andWhere('a.fecha >= :desde', { desde })
      .andWhere('a.fecha <= :hasta', { hasta });

    if (query.estado) {
      qb.andWhere('a.estado = :estado', { estado: query.estado });
    }

    const attendances = await qb.orderBy('a.fecha', 'DESC').addOrderBy('a.id', 'ASC').getMany();
    const seenIds = new Set<number>();
    const rows: ReportRow[] = [];

    for (const att of attendances) {
      if (seenIds.has(att.id)) continue;
      seenIds.add(att.id);

      const st = studentMap.get(att.studentId);
      if (!st) continue;

      const nombre = `${st.apellido} ${st.nombre}`.trim();
      if (!matchSearch(query.busqueda, nombre, st.dni, st.codigo)) continue;

      rows.push({
        ...(consolidado
          ? { institucion: instMap.get(st.institutionId ?? 0) ?? '—' }
          : {}),
        estudiante: nombre,
        nivel: st.nivel,
        grado: st.grado,
        seccion: st.seccion,
        fecha: att.fecha,
        estado: ESTADO_ASISTENCIA_LABEL[att.estado] ?? att.estado,
        observacion: att.observacion ?? '',
      });
    }

    meta.totales = {
      totalRegistros: rows.length,
      totalAlumnos: new Set(attendances.map((a) => a.studentId)).size,
      presentes: rows.filter((r) => r.estado === 'Presente').length,
      faltas: rows.filter((r) => r.estado === 'Falta').length,
      tardanzas: rows.filter((r) => r.estado === 'Tardanza').length,
      justificadas: rows.filter((r) => r.estado === 'Justificada').length,
      institucionesIncluidas: scope.alcance.institucionesCount,
    };

    return { meta, columns, rows };
  }

  private async buildResumenReport(
    query: NormalizedAttendanceReportQuery,
    scope: ReportScope,
    mes: string,
  ): Promise<{ meta: ReportMeta; columns: ReportColumn[]; rows: ReportRow[] }> {
    const meta = await this.buildMeta(query, scope, 'asistencia_resumen', mes);
    const consolidado = scope.mode === 'consolidado';
    const columns: ReportColumn[] = [
      ...(consolidado ? [{ key: 'institucion', label: 'Institución' }] : []),
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'grado', label: 'Grado' },
      { key: 'seccion', label: 'Sección' },
      { key: 'presentes', label: 'Presentes' },
      { key: 'faltas', label: 'Faltas' },
      { key: 'tardanzas', label: 'Tardanzas' },
      { key: 'justificadas', label: 'Justificadas' },
      { key: 'totalRegistros', label: 'Total registros' },
      { key: 'asistenciaPct', label: '% Asistencia' },
    ];

    const students = await this.fetchStudents(query, scope.institutionIds);
    const studentIds = students.map((s) => s.id);
    const instMap = await this.institutionNameMap(scope.institutionIds);

    if (!studentIds.length) {
      meta.totales = { totalAlumnos: 0, totalRegistros: 0 };
      return { meta, columns, rows: [] };
    }

    const { desde, hasta } = this.mesRange(mes);
    const attendances = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.studentId IN (:...studentIds)', { studentIds })
      .andWhere('a.fecha >= :desde', { desde })
      .andWhere('a.fecha <= :hasta', { hasta })
      .getMany();

    const byStudent = new Map<number, Attendance[]>();
    for (const att of attendances) {
      const list = byStudent.get(att.studentId) ?? [];
      list.push(att);
      byStudent.set(att.studentId, list);
    }

    const rows: ReportRow[] = [];
    for (const st of students) {
      const nombre = `${st.apellido} ${st.nombre}`.trim();
      if (!matchSearch(query.busqueda, nombre, st.dni, st.codigo)) continue;

      const records = byStudent.get(st.id) ?? [];
      if (query.estado && !records.some((r) => r.estado === query.estado)) continue;

      const presentes = records.filter((r) => r.estado === 'P').length;
      const faltas = records.filter((r) => r.estado === 'F').length;
      const tardanzas = records.filter((r) => r.estado === 'T').length;
      const justificadas = records.filter((r) => r.estado === 'J').length;
      const total = records.length;
      const asistenciaPct =
        total > 0 ? Math.round(((presentes + tardanzas) / total) * 100) : null;

      rows.push({
        ...(consolidado
          ? { institucion: instMap.get(st.institutionId ?? 0) ?? '—' }
          : {}),
        estudiante: nombre,
        nivel: st.nivel,
        grado: st.grado,
        seccion: st.seccion,
        presentes,
        faltas,
        tardanzas,
        justificadas,
        totalRegistros: total,
        asistenciaPct,
      });
    }

    rows.sort((a, b) =>
      String(a.estudiante).localeCompare(String(b.estudiante), 'es'),
    );

    meta.totales = {
      totalAlumnos: rows.length,
      totalRegistros: attendances.length,
      presentes: rows.reduce((s, r) => s + Number(r.presentes ?? 0), 0),
      faltas: rows.reduce((s, r) => s + Number(r.faltas ?? 0), 0),
      tardanzas: rows.reduce((s, r) => s + Number(r.tardanzas ?? 0), 0),
      justificadas: rows.reduce((s, r) => s + Number(r.justificadas ?? 0), 0),
      institucionesIncluidas: scope.alcance.institucionesCount,
    };

    return { meta, columns, rows };
  }

  private async fetchStudents(
    query: NormalizedAttendanceReportQuery,
    institutionIds: number[],
  ): Promise<Student[]> {
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.institutionId IN (:...ids)', { ids: institutionIds });

    if (query.nivel) {
      qb.andWhere('LOWER(TRIM(s.nivel)) = LOWER(TRIM(:nivel))', { nivel: query.nivel });
    }
    if (query.grado) {
      qb.andWhere('LOWER(TRIM(s.grado)) = LOWER(TRIM(:grado))', { grado: query.grado });
    }
    if (query.seccion) {
      qb.andWhere('UPPER(TRIM(s.seccion)) = UPPER(TRIM(:seccion))', {
        seccion: query.seccion,
      });
    }

    return qb.orderBy('s.apellido', 'ASC').addOrderBy('s.nombre', 'ASC').getMany();
  }

  private resolveMes(query: NormalizedAttendanceReportQuery): string {
    if (query.mes) {
      if (!/^\d{4}-\d{2}$/.test(query.mes)) {
        throw new BadRequestException('El mes debe tener formato YYYY-MM');
      }
      return query.mes;
    }
    if (query.anio) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `${query.anio}-${month}`;
    }
    return this.currentMes();
  }

  private currentMes(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private mesRange(mes: string): { desde: string; hasta: string } {
    const [yearStr, monthStr] = mes.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      desde: `${mes}-01`,
      hasta: `${mes}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async buildMeta(
    query: NormalizedAttendanceReportQuery,
    scope: ReportScope,
    tipo: AttendanceReportType,
    mes: string,
  ): Promise<ReportMeta> {
    const institution = await this.resolveInstitution(scope.primaryInstitutionId);
    const anioEscolar =
      query.anio ?? (await this.periodosService.resolveAnioEscolarActual());
    const periodo =
      query.periodo ?? (await this.periodosService.resolveBimestreActual());

    return {
      fechaCorte: new Date().toISOString(),
      anioEscolar,
      bimestre: periodo,
      tipo,
      fuente: ATTENDANCE_REPORT_SOURCES[tipo],
      parametros: { ...query, mes, scopeKey: scope.scopeKey },
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

  private async institutionNameMap(ids: number[]): Promise<Map<number, string>> {
    const insts = await this.loadInstitutions(ids);
    return new Map(insts.map((i) => [i.id, i.nombre]));
  }
}
